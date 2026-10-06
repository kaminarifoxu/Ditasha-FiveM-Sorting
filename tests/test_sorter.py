from pathlib import Path

from ditasha_sorter.core import classify_file


def cat(tmp_path: Path, name: str):
    p = tmp_path / name
    p.write_bytes(b'x')
    return classify_file(p)[0]


def test_hair(tmp_path):
    assert cat(tmp_path, 'mp_m_freemode_01_mp_m_pack^hair_000_u.ydd') == 'hair'
    assert cat(tmp_path, 'hair_diff_000_a_uni.ytd') == 'hair'


def test_clothes(tmp_path):
    assert cat(tmp_path, 'mp_m_freemode_01_mp_m_pack^jbib_001_u.ydd') == 'clothes/tops'
    assert cat(tmp_path, 'lowr_diff_001_a_uni.ytd') == 'clothes/pants'
    assert cat(tmp_path, 'feet_003_u.ydd') == 'clothes/shoes'
    assert cat(tmp_path, 'p_head_003.ydd') == 'clothes/hats'


def test_standalone_ped(tmp_path):
    assert cat(tmp_path, 'my_custom_ped.ydd') == 'peds'
    (tmp_path / 'my_custom_ped.ydd').write_bytes(b'model')
    assert cat(tmp_path, 'my_custom_ped.ytd') == 'peds'
