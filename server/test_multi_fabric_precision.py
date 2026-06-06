import json
import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import calc_engine


class MultiFabricPrecisionTests(unittest.TestCase):
    def test_area_method_uses_actual_quantity_and_rounds_up(self):
        fabric = {
            "id": "main",
            "name": "主面料",
            "fabric_width": 145,
            "shrinkage_rate": 0,
        }
        expected_lengths = {1: 10, 2: 20, 4: 40}
        for quantity, expected_length in expected_lengths.items():
            with self.subTest(quantity=quantity):
                detail = calc_engine._calculate_area_method_piece(
                    {
                        "name": "测试裁片",
                        "height": 50,
                        "width": 20,
                        "quantity": quantity,
                        "material": "main",
                    },
                    fabric,
                    seam_allowance=0,
                )
                self.assertEqual(2, detail["pieces_per_row"])
                self.assertEqual(expected_length, detail["length_cm"])

    def test_area_method_belt_rounds_8_28_up_to_9_cm(self):
        detail = calc_engine._calculate_area_method_piece(
            {
                "name": "腰带",
                "height": 8,
                "width": 149,
                "quantity": 1,
                "material": "main",
            },
            {
                "id": "main",
                "name": "主面料",
                "fabric_width": 145,
                "shrinkage_rate": 0,
            },
            seam_allowance=0,
        )
        self.assertEqual(18, detail["pieces_per_row"])
        self.assertAlmostEqual(149 / 18, detail["raw_length_cm"], places=4)
        self.assertEqual(9, detail["length_cm"])

    def test_area_method_applies_seam_and_shrinkage_before_length(self):
        detail = calc_engine._calculate_area_method_piece(
            {
                "name": "腰带",
                "height": 8,
                "width": 149,
                "quantity": 1,
                "material": "main",
            },
            {
                "id": "main",
                "name": "主面料",
                "fabric_width": 145,
                "shrinkage_rate": 0.5,
            },
            seam_allowance=1.5,
        )
        expected_crosswise = 11 / 0.995
        expected_lengthwise = 152 / 0.995
        expected_per_row = int(145 // expected_crosswise)
        self.assertAlmostEqual(expected_crosswise, detail["effective_crosswise_cm"], places=4)
        self.assertEqual(expected_per_row, detail["pieces_per_row"])
        self.assertEqual(
            __import__("math").ceil(expected_lengthwise / expected_per_row),
            detail["length_cm"],
        )

    def test_material_total_adds_nesting_and_each_area_piece(self):
        measurements = {
            "category": "coat",
            "pieces": [
                {
                    "name": "前片",
                    "width": 40,
                    "height": 70,
                    "quantity": 2,
                    "material": "main",
                    "calculation_method": "nesting",
                },
                {
                    "name": "腰带",
                    "width": 149,
                    "height": 8,
                    "quantity": 1,
                    "material": "main",
                    "calculation_method": "area",
                },
            ],
        }
        completed = type("Completed", (), {
            "returncode": 0,
            "stdout": json.dumps({"pattern": {}, "seam": {}, "nesting": {}}),
            "stderr": "",
        })()
        nesting_result = {
            "success": True,
            "data": {
                "pieces": [],
                "positions": [],
                "per_piece_length_m": 1.2,
                "net_length_m": 1.2,
                "production_length_m": 1.2,
                "total_area_m2": 1,
                "utilization_rate": 80,
                "statistics": {},
            },
        }

        with patch.object(calc_engine.subprocess, "run", return_value=completed), \
                patch.object(calc_engine, "_find_npx", return_value="npx"), \
                patch.object(calc_engine, "generate_nesting_layout", return_value=nesting_result):
            result = calc_engine.generate_all_modules(
                measurements,
                seam_allowance=0,
                fabrics=[{
                    "id": "main",
                    "name": "主面料",
                    "fabric_width": 145,
                    "shrinkage_rate": 0,
                }],
            )

        group = result["nesting_groups"][0]
        self.assertEqual(1.2, group["nesting_length_m"])
        self.assertEqual(0.09, group["area_method_length_m"])
        self.assertEqual(1.29, group["per_piece_length_m"])

    def test_each_material_uses_its_own_width_and_shrinkage(self):
        measurements = {
            "category": "coat",
            "pieces": [
                {"name": "外层前片", "width": 40, "height": 70, "quantity": 2, "material": "shell"},
                {"name": "里布前片", "width": 38, "height": 68, "quantity": 2, "material": "lining"},
            ],
        }
        fabrics = [
            {
                "id": "shell",
                "name": "毛呢外料",
                "fabric_type": "woven",
                "fabric_width": 150,
                "shrinkage_rate": 2.5,
            },
            {
                "id": "lining",
                "name": "里料",
                "fabric_type": "lining",
                "fabric_width": 140,
                "shrinkage_rate": 0.5,
            },
        ]
        runner_output = {
            "pattern": {"pieces": []},
            "seam": {"pieces": []},
            "nesting": {},
        }
        calls = []

        def fake_group_nesting(group_measurements, fabric_width, seam_allowance, options):
            calls.append({
                "material": group_measurements["pieces"][0]["material"],
                "fabric_width": fabric_width,
                "shrinkage_rate": options["shrinkage_rate"],
            })
            return {
                "success": True,
                "data": {
                    "pieces": [],
                    "positions": [],
                    "per_piece_length_m": 1,
                    "total_area_m2": 1,
                    "utilization_rate": 80,
                },
            }

        completed = type("Completed", (), {
            "returncode": 0,
            "stdout": json.dumps(runner_output),
            "stderr": "",
        })()

        with patch.object(calc_engine.subprocess, "run", return_value=completed), \
                patch.object(calc_engine, "_find_npx", return_value="npx"), \
                patch.object(calc_engine, "generate_nesting_layout", side_effect=fake_group_nesting):
            result = calc_engine.generate_all_modules(
                measurements,
                seam_allowance=1.5,
                fabrics=fabrics,
            )

        self.assertTrue(result["success"])
        self.assertEqual([
            {"material": "shell", "fabric_width": 150.0, "shrinkage_rate": 2.5},
            {"material": "lining", "fabric_width": 140.0, "shrinkage_rate": 0.5},
        ], calls)
        self.assertEqual("毛呢外料", result["nesting_groups"][0]["material_name"])
        self.assertEqual("里料", result["nesting_groups"][1]["material_name"])

    def test_missing_fabric_configuration_is_rejected(self):
        measurements = {
            "category": "coat",
            "pieces": [
                {"name": "前片", "width": 40, "height": 70, "quantity": 2, "material": "missing"},
                {"name": "后片", "width": 40, "height": 70, "quantity": 1, "material": "shell"},
            ],
        }
        completed = type("Completed", (), {
            "returncode": 0,
            "stdout": json.dumps({"pattern": {}, "seam": {}, "nesting": {}}),
            "stderr": "",
        })()

        with patch.object(calc_engine.subprocess, "run", return_value=completed), \
                patch.object(calc_engine, "_find_npx", return_value="npx"):
            result = calc_engine.generate_all_modules(
                measurements,
                fabrics=[{
                    "id": "shell",
                    "name": "主面料",
                    "fabric_width": 145,
                    "shrinkage_rate": 0.5,
                }],
            )

        self.assertFalse(result["success"])
        self.assertIn("missing", result["error"])


if __name__ == "__main__":
    unittest.main()
