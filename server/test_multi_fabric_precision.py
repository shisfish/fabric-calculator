import json
import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import calc_engine


class MultiFabricPrecisionTests(unittest.TestCase):
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
