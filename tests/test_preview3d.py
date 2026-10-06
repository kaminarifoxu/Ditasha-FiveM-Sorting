import numpy as np

from ditasha_sorter.preview3d import PreviewGeometry, PreviewScene


def test_preview_scene_container():
    geom = PreviewGeometry(
        positions=np.zeros((3, 3), dtype=np.float32),
        normals=None,
        texcoords=None,
        indices=np.array([0, 1, 2], dtype=np.uint32),
        texture_name=None,
    )
    scene = PreviewScene([geom], {}, np.zeros(3, dtype=np.float32), 1.0)
    assert scene.radius == 1.0
    assert scene.geometries[0].indices.size == 3
