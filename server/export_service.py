from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile
from xml.sax.saxutils import escape


def build_document(document, export_format):
    if export_format == "word":
        return _build_docx(document), "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"
    if export_format == "excel":
        return _build_xlsx(document), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"
    raise ValueError("不支持的导出格式")


def _build_docx(document):
    title = str(document.get("title") or "导出文档")
    summary = document.get("summary") or []
    sections = document.get("sections") or []
    body = [_docx_paragraph(title, bold=True, size=32)]

    for item in summary:
        body.append(_docx_paragraph(f"{item.get('label', '')}: {item.get('value', '')}", size=22))

    for section in sections:
        body.append(_docx_paragraph(section.get("title", ""), bold=True, size=26))
        headers = [str(value) for value in section.get("headers") or []]
        rows = section.get("rows") or []
        if headers:
            body.append(_docx_table(headers, rows))

    document_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    {''.join(body)}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/>
    </w:sectPr>
  </w:body>
</w:document>"""
    content_types = """<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>"""
    relationships = """<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""

    output = BytesIO()
    with ZipFile(output, "w", ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("_rels/.rels", relationships)
        archive.writestr("word/document.xml", document_xml)
    return output.getvalue()


def _docx_paragraph(text, bold=False, size=22):
    bold_xml = "<w:b/>" if bold else ""
    return (
        "<w:p><w:r><w:rPr>"
        f"{bold_xml}<w:sz w:val=\"{size}\"/><w:szCs w:val=\"{size}\"/>"
        "</w:rPr>"
        f"<w:t xml:space=\"preserve\">{escape(str(text or ''))}</w:t>"
        "</w:r></w:p>"
    )


def _docx_table(headers, rows):
    all_rows = [headers] + [[str(value if value is not None else "") for value in row] for row in rows]
    row_xml = []
    for row_index, row in enumerate(all_rows):
        cells = []
        for value in row:
            bold_xml = "<w:b/>" if row_index == 0 else ""
            cells.append(
                "<w:tc><w:tcPr><w:tcW w:w=\"0\" w:type=\"auto\"/></w:tcPr>"
                "<w:p><w:r><w:rPr>"
                f"{bold_xml}<w:sz w:val=\"18\"/>"
                "</w:rPr>"
                f"<w:t xml:space=\"preserve\">{escape(value)}</w:t>"
                "</w:r></w:p></w:tc>"
            )
        row_xml.append(f"<w:tr>{''.join(cells)}</w:tr>")
    borders = (
        "<w:tblBorders>"
        "<w:top w:val=\"single\" w:sz=\"4\" w:color=\"B8C2D1\"/>"
        "<w:left w:val=\"single\" w:sz=\"4\" w:color=\"B8C2D1\"/>"
        "<w:bottom w:val=\"single\" w:sz=\"4\" w:color=\"B8C2D1\"/>"
        "<w:right w:val=\"single\" w:sz=\"4\" w:color=\"B8C2D1\"/>"
        "<w:insideH w:val=\"single\" w:sz=\"4\" w:color=\"B8C2D1\"/>"
        "<w:insideV w:val=\"single\" w:sz=\"4\" w:color=\"B8C2D1\"/>"
        "</w:tblBorders>"
    )
    return f"<w:tbl><w:tblPr>{borders}</w:tblPr>{''.join(row_xml)}</w:tbl>"


def _build_xlsx(document):
    sheets = []
    summary_rows = [[document.get("title") or "导出文档", ""], [], ["项目", "内容"]]
    summary_rows.extend([[item.get("label", ""), item.get("value", "")] for item in document.get("summary") or []])
    sheets.append(("概览", summary_rows))

    for index, section in enumerate(document.get("sections") or []):
        title = _safe_sheet_name(section.get("title") or f"明细{index + 1}", index)
        rows = [section.get("headers") or []] + (section.get("rows") or [])
        sheets.append((title, rows))

    workbook_sheets = []
    workbook_relationships = []
    content_overrides = []
    output = BytesIO()
    with ZipFile(output, "w", ZIP_DEFLATED) as archive:
        for index, (name, rows) in enumerate(sheets, start=1):
            archive.writestr(f"xl/worksheets/sheet{index}.xml", _worksheet_xml(rows))
            workbook_sheets.append(f'<sheet name="{escape(name)}" sheetId="{index}" r:id="rId{index}"/>')
            workbook_relationships.append(
                f'<Relationship Id="rId{index}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{index}.xml"/>'
            )
            content_overrides.append(
                f'<Override PartName="/xl/worksheets/sheet{index}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            )

        workbook_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>{''.join(workbook_sheets)}</sheets>
</workbook>"""
        workbook_rels = f"""<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  {''.join(workbook_relationships)}
</Relationships>"""
        content_types = f"""<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  {''.join(content_overrides)}
</Types>"""
        relationships = """<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>"""
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("_rels/.rels", relationships)
        archive.writestr("xl/workbook.xml", workbook_xml)
        archive.writestr("xl/_rels/workbook.xml.rels", workbook_rels)
    return output.getvalue()


def _worksheet_xml(rows):
    row_xml = []
    for row_index, row in enumerate(rows or [], start=1):
        cells = []
        for column_index, value in enumerate(row or [], start=1):
            ref = f"{_excel_column(column_index)}{row_index}"
            cells.append(
                f'<c r="{ref}" t="inlineStr"><is><t xml:space="preserve">{escape(str(value if value is not None else ""))}</t></is></c>'
            )
        row_xml.append(f'<row r="{row_index}">{"".join(cells)}</row>')
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>{''.join(row_xml)}</sheetData>
</worksheet>"""


def _excel_column(index):
    result = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        result = chr(65 + remainder) + result
    return result


def _safe_sheet_name(name, index):
    cleaned = "".join("_" if char in "[]:*?/\\" else char for char in str(name))[:31]
    return cleaned or f"Sheet{index + 1}"
