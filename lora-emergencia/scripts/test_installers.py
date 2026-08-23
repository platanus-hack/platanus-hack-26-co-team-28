import subprocess
import unittest
from pathlib import Path


SCRIPTS = Path(__file__).resolve().parent


class InstallerContractTests(unittest.TestCase):
    def test_installers_have_valid_bash_syntax(self):
        paths = [
            SCRIPTS / "lib" / "woki_install_common.sh",
            SCRIPTS / "instalar_maestro.sh",
            SCRIPTS / "instalar_esclavo.sh",
        ]
        result = subprocess.run(
            ["bash", "-n", *map(str, paths)], capture_output=True, text=True
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_master_help_describes_full_clean_laptop_setup(self):
        result = subprocess.run(
            ["bash", str(SCRIPTS / "instalar_maestro.sh"), "--help"],
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Arduino CLI", result.stdout)
        self.assertIn("Python", result.stdout)
        self.assertIn("gateway_bidir", result.stdout)

    def test_slave_help_requires_an_operational_identity(self):
        result = subprocess.run(
            ["bash", str(SCRIPTS / "instalar_esclavo.sh"), "--help"],
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("--id", result.stdout)
        self.assertIn("--type", result.stdout)
        self.assertIn("--zone", result.stdout)


if __name__ == "__main__":
    unittest.main()
