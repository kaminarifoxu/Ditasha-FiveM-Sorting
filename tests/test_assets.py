from pathlib import Path

from ditasha_sorter.assets import find_asset_groups


def test_pairs_one_ydd_with_many_ytd(tmp_path: Path):
    (tmp_path / 'jbib_007_u.ydd').write_bytes(b'model')
    (tmp_path / 'jbib_diff_007_a_uni.ytd').write_bytes(b'a')
    (tmp_path / 'jbib_diff_007_b_uni.ytd').write_bytes(b'b')
    (tmp_path / 'jbib_diff_008_a_uni.ytd').write_bytes(b'other')

    groups = find_asset_groups(tmp_path)
    assert len(groups) == 1
    assert [p.name for p in groups[0].textures] == [
        'jbib_diff_007_a_uni.ytd',
        'jbib_diff_007_b_uni.ytd',
    ]


def test_pairs_prop_prefix(tmp_path: Path):
    (tmp_path / 'p_head_003.ydd').write_bytes(b'model')
    (tmp_path / 'p_head_diff_003_a.ytd').write_bytes(b'a')
    groups = find_asset_groups(tmp_path)
    assert groups[0].textures[0].name == 'p_head_diff_003_a.ytd'
