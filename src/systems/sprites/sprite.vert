attribute vec4 mvCol0;
attribute vec4 mvCol1;
attribute vec4 mvCol2;
attribute vec4 mvCol3;
attribute vec3 a_vertices;
attribute vec2 a_uvs;
varying vec2 v_uvs;

void main() {
  mat4 mv = mat4(mvCol0, mvCol1, mvCol2, mvCol3);
  gl_Position = projectionMatrix * modelViewMatrix * mv * vec4(a_vertices, 1.0);
  v_uvs = a_uvs;
}
