import {
  ShaderMaterial,
  DoubleSide,
  PlaneGeometry,
  type CanvasTexture,
} from "three";

const vertexShader = /* glsl */ `
  attribute vec4 aAtlasUV;
  attribute float aAlpha;
  attribute vec3 aColor;

  varying vec2 vUv;
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    // Billboard: viewMatrix에서 카메라 축 추출 (CPU 비용 0)
    vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 camUp    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);

    // instanceMatrix는 위치만 포함
    vec4 worldPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);

    vec3 pos = worldPos.xyz
      + camRight * position.x
      + camUp * position.y;

    gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);

    vUv = mix(aAtlasUV.xy, aAtlasUV.zw, uv);
    vAlpha = aAlpha;
    vColor = aColor;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform float uDebug;

  varying vec2 vUv;
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    // uDebug=1: UV를 색상으로 표시 (텍스처 무시, 지오메트리/UV 검증용)
    // uDebug=2: 텍스처 alpha를 흰색으로 표시 (alpha 채널 검증)
    if (uDebug > 0.5) {
      if (uDebug > 1.5) {
        // mode 2: alpha channel visualization
        vec4 texel = texture2D(uAtlas, vUv);
        gl_FragColor = vec4(texel.a, texel.a, texel.a, 1.0);
      } else {
        // mode 1: UV as color
        gl_FragColor = vec4(vUv.x, vUv.y, 0.5, 1.0);
      }
      return;
    }

    vec4 texel = texture2D(uAtlas, vUv);
    float a = texel.a * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(texel.rgb * vColor, a);
  }
`;

/**
 * Atlas 텍스트용 ShaderMaterial.
 * - GPU billboard (vertex shader)
 * - per-instance: aAtlasUV(vec4), aAlpha(float), aColor(vec3)
 * - regular alpha blending
 */
export function createAtlasTextMaterial(atlas: CanvasTexture): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uAtlas: { value: atlas }, uDebug: { value: 0 } },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: DoubleSide,
    toneMapped: false,
  });
}

/**
 * Atlas 텍스트 쿼드 지오메트리 생성.
 * displayHeight = 월드 단위 높이, cellAspect = cellW/cellH.
 */
export function createAtlasTextGeometry(displayHeight: number, cellAspect: number): PlaneGeometry {
  return new PlaneGeometry(displayHeight * cellAspect, displayHeight);
}
