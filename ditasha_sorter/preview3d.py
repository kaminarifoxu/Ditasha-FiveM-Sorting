from __future__ import annotations

import io
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image
from OpenGL import GL, GLU
from pyopengltk import OpenGLFrame

try:
    from szio.gta5 import AssetDrawableDictionary, AssetTextureDictionary, LodLevel, try_load_asset
    from szio.gta5.native import IS_BACKEND_AVAILABLE
except Exception:
    AssetDrawableDictionary = AssetTextureDictionary = None
    LodLevel = None
    try_load_asset = None
    IS_BACKEND_AVAILABLE = False


@dataclass
class PreviewGeometry:
    positions: np.ndarray
    normals: np.ndarray | None
    texcoords: np.ndarray | None
    indices: np.ndarray
    texture_name: str | None


@dataclass
class PreviewScene:
    geometries: list[PreviewGeometry]
    textures: dict[str, Image.Image]
    center: np.ndarray
    radius: float


def backend_status() -> tuple[bool, str]:
    if try_load_asset is None:
        return False, 'szio belum tersedia.'
    if not IS_BACKEND_AVAILABLE:
        return False, 'PyMateria native backend belum tersedia. Preview YDD/YTD membutuhkan Windows + PyMateria.'
    return True, '3D backend siap.'


def _find_diffuse_name(drawable, shader_index: int) -> str | None:
    group = getattr(drawable, 'shader_group', None)
    if not group or shader_index >= len(group.shaders):
        return None
    shader = group.shaders[shader_index]
    for param in shader.parameters:
        if isinstance(param.value, str):
            name = param.name.lower()
            if 'diffuse' in name or name in {'texturesampler', 'basetexturesampler'}:
                return param.value
    return None


def _decode_texture_dict(path: Path | None) -> dict[str, Image.Image]:
    if not path:
        return {}
    asset = try_load_asset(path)
    if not isinstance(asset, AssetTextureDictionary):
        return {}
    result = {}
    for name, tex in asset.textures.items():
        if tex.data is None:
            continue
        try:
            image = Image.open(io.BytesIO(tex.data.read_bytes())).convert('RGBA')
            result[str(name).lower()] = image.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        except Exception:
            continue
    return result


def load_scene(model_path: str | Path, texture_path: str | Path | None = None) -> PreviewScene:
    ok, reason = backend_status()
    if not ok:
        raise RuntimeError(reason)

    asset = try_load_asset(Path(model_path))
    if not isinstance(asset, AssetDrawableDictionary):
        raise RuntimeError('File bukan drawable dictionary YDD yang didukung.')

    geometries = []
    all_positions = []
    for drawable in asset.drawables.values():
        models = drawable.models.get(LodLevel.HIGH) or next(iter(drawable.models.values()), [])
        for model in models:
            for geom in model.geometries:
                vb = geom.vertex_buffer
                names = vb.dtype.names or ()
                if 'Position' not in names:
                    continue
                positions = np.ascontiguousarray(vb['Position'], dtype=np.float32).reshape((-1, 3))
                normals = np.ascontiguousarray(vb['Normal'], dtype=np.float32).reshape((-1, 3)) if 'Normal' in names else None
                texcoords = np.ascontiguousarray(vb['TexCoord0'], dtype=np.float32).reshape((-1, 2)) if 'TexCoord0' in names else None
                indices = np.ascontiguousarray(geom.index_buffer, dtype=np.uint32).reshape(-1)
                geometries.append(PreviewGeometry(
                    positions, normals, texcoords, indices,
                    _find_diffuse_name(drawable, geom.shader_index)
                ))
                all_positions.append(positions)

    if not geometries:
        raise RuntimeError('Tidak ada geometry yang dapat dipreview.')

    points = np.concatenate(all_positions, axis=0)
    minimum, maximum = points.min(axis=0), points.max(axis=0)
    center = (minimum + maximum) * 0.5
    radius = max(float(np.linalg.norm(maximum - minimum) * 0.5), 1.0e-4)
    texture = Path(texture_path) if texture_path else None
    return PreviewScene(geometries, _decode_texture_dict(texture), center.astype(np.float32), radius)


class YddPreviewFrame(OpenGLFrame):
    def __init__(self, master, **kwargs):
        super().__init__(master, **kwargs)
        self.scene = None
        self.rotation_x = -8.0
        self.rotation_y = 180.0
        self.zoom = 1.0
        self._last_mouse = None
        self._texture_ids = {}
        self.animate = 1
        self.bind('<ButtonPress-1>', self._mouse_down)
        self.bind('<B1-Motion>', self._mouse_drag)
        self.bind('<MouseWheel>', self._mouse_wheel)
        self.bind('<Button-4>', lambda _e: self._zoom_by(1.1))
        self.bind('<Button-5>', lambda _e: self._zoom_by(0.9))

    def initgl(self):
        GL.glClearColor(0.055, 0.06, 0.07, 1.0)
        GL.glEnable(GL.GL_DEPTH_TEST)
        GL.glEnable(GL.GL_CULL_FACE)
        GL.glEnable(GL.GL_BLEND)
        GL.glBlendFunc(GL.GL_SRC_ALPHA, GL.GL_ONE_MINUS_SRC_ALPHA)
        GL.glEnable(GL.GL_LIGHTING)
        GL.glEnable(GL.GL_LIGHT0)
        GL.glLightfv(GL.GL_LIGHT0, GL.GL_POSITION, (2.0, -2.0, 4.0, 0.0))
        GL.glLightfv(GL.GL_LIGHT0, GL.GL_AMBIENT, (0.32, 0.32, 0.32, 1.0))
        GL.glEnable(GL.GL_COLOR_MATERIAL)

    def load_asset(self, model_path, texture_path=None):
        self.scene = load_scene(model_path, texture_path)
        self._texture_ids.clear()
        self.reset_view()

    def clear_asset(self):
        self.scene = None
        self._texture_ids.clear()

    def reset_view(self):
        self.rotation_x = -8.0
        self.rotation_y = 180.0
        self.zoom = 1.0

    def _mouse_down(self, event):
        self._last_mouse = (event.x, event.y)

    def _mouse_drag(self, event):
        if self._last_mouse:
            self.rotation_y += (event.x - self._last_mouse[0]) * 0.55
            self.rotation_x += (event.y - self._last_mouse[1]) * 0.55
        self._last_mouse = (event.x, event.y)

    def _zoom_by(self, factor):
        self.zoom = min(5.0, max(0.18, self.zoom * factor))

    def _mouse_wheel(self, event):
        self._zoom_by(1.12 if event.delta > 0 else 0.89)

    def _ensure_texture(self, name):
        if not self.scene or not self.scene.textures:
            return 0
        key = (name or '').lower()
        if key not in self.scene.textures:
            key = next(iter(self.scene.textures))
        if key in self._texture_ids:
            return self._texture_ids[key]
        image = self.scene.textures[key]
        tex_id = GL.glGenTextures(1)
        GL.glBindTexture(GL.GL_TEXTURE_2D, tex_id)
        GL.glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MIN_FILTER, GL.GL_LINEAR)
        GL.glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MAG_FILTER, GL.GL_LINEAR)
        rgba = np.asarray(image, dtype=np.uint8)
        GL.glTexImage2D(GL.GL_TEXTURE_2D, 0, GL.GL_RGBA, image.width, image.height, 0,
                        GL.GL_RGBA, GL.GL_UNSIGNED_BYTE, rgba)
        self._texture_ids[key] = int(tex_id)
        return int(tex_id)

    def redraw(self):
        width, height = max(1, self.winfo_width()), max(1, self.winfo_height())
        GL.glViewport(0, 0, width, height)
        GL.glClear(GL.GL_COLOR_BUFFER_BIT | GL.GL_DEPTH_BUFFER_BIT)
        if not self.scene:
            return
        GL.glMatrixMode(GL.GL_PROJECTION)
        GL.glLoadIdentity()
        GLU.gluPerspective(42.0, width / height, 0.01, 10000.0)
        GL.glMatrixMode(GL.GL_MODELVIEW)
        GL.glLoadIdentity()
        GL.glTranslatef(0.0, 0.0, -(self.scene.radius * 3.1) / self.zoom)
        GL.glRotatef(self.rotation_x, 1.0, 0.0, 0.0)
        GL.glRotatef(self.rotation_y, 0.0, 0.0, 1.0)
        GL.glTranslatef(*(-self.scene.center))
        GL.glColor4f(1.0, 1.0, 1.0, 1.0)

        for geom in self.scene.geometries:
            tex_id = self._ensure_texture(geom.texture_name)
            if tex_id and geom.texcoords is not None:
                GL.glEnable(GL.GL_TEXTURE_2D)
                GL.glBindTexture(GL.GL_TEXTURE_2D, tex_id)
                GL.glEnableClientState(GL.GL_TEXTURE_COORD_ARRAY)
                GL.glTexCoordPointer(2, GL.GL_FLOAT, 0, geom.texcoords)
            GL.glEnableClientState(GL.GL_VERTEX_ARRAY)
            GL.glVertexPointer(3, GL.GL_FLOAT, 0, geom.positions)
            if geom.normals is not None:
                GL.glEnableClientState(GL.GL_NORMAL_ARRAY)
                GL.glNormalPointer(GL.GL_FLOAT, 0, geom.normals)
            GL.glDrawElements(GL.GL_TRIANGLES, int(geom.indices.size), GL.GL_UNSIGNED_INT, geom.indices)
            GL.glDisableClientState(GL.GL_VERTEX_ARRAY)
            if geom.normals is not None:
                GL.glDisableClientState(GL.GL_NORMAL_ARRAY)
            if tex_id and geom.texcoords is not None:
                GL.glDisableClientState(GL.GL_TEXTURE_COORD_ARRAY)
                GL.glDisable(GL.GL_TEXTURE_2D)
