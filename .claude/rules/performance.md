---
paths:
  - "src/**"
---

# 성능 최적화 규칙

## 렌더링 최적화
- **`useRef` > `useState`**: 리렌더 불필요한 값은 반드시 `useRef`
- **`React.memo`**: props가 자주 안 바뀌는 자식 컴포넌트에 적용
- **`useMemo`/`useCallback`**: 비용 큰 연산 또는 참조 안정성 필요 시에만
- **리렌더 추적**: React DevTools Profiler 활용

```typescript
// Bad: 불필요한 리렌더 유발
const [scrollPosition, setScrollPosition] = useState(0);

// Good: DOM 관련 값은 ref로
const scrollPositionRef = useRef(0);
```

## 데이터 처리
- **Typed Arrays**: 대량 수치 데이터는 `Float32Array`, `Uint8Array` 등
- **Web Workers**: CPU 집약적 작업은 메인 스레드에서 분리
- **가상화**: 긴 리스트는 `@tanstack/react-virtual`
- **이미지**: lazy loading 기본, WebP/AVIF, srcset 반응형

```typescript
// 대량 데이터: typed array
const audioBuffer = new Float32Array(sampleRate * duration);
```

## 번들 최적화
- **코드 스플리팅**: `React.lazy()` + `Suspense` 라우트 단위
- **트리 셰이킹**: named import, barrel file 남용 금지
- **동적 임포트**: 조건부 로드는 `import()` 사용
