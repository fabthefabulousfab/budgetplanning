import os
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_uv_absent_message_explicite(tmp_path):
    # Copie du script dans un dossier temporaire : le vrai budget.xlsx n'est jamais touché.
    shutil.copy(ROOT / "demarrer.sh", tmp_path / "demarrer.sh")
    (tmp_path / "budget.xlsx").write_bytes(b"")
    outils = tmp_path / "outils"
    outils.mkdir()
    os.symlink(shutil.which("dirname"), outils / "dirname")
    env = {"PATH": str(outils), "DEMARRER_SANS_OUVRIR": "1"}
    r = subprocess.run(
        [shutil.which("sh"), str(tmp_path / "demarrer.sh")],
        cwd=tmp_path, env=env, capture_output=True, text=True,
    )
    assert r.returncode == 1
    assert "uv est introuvable" in r.stderr
    assert "a échoué" not in r.stderr
