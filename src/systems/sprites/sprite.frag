precision mediump float;

uniform sampler2D u_spritesheet;

varying vec2 v_uvs;

void main() {
    vec4 texColor = texture2D(u_spritesheet, v_uvs);
    gl_FragColor = vec4(texColor.rgb, texColor.a);
}
