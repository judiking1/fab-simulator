---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript 상세 규칙

## tsconfig 핵심 설정
```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInImports": true
  }
}
```

## 타입 작성 규칙
- `any` 금지 → `unknown` + 타입 가드
- `interface` 우선 (union/intersection/mapped type에만 `type`)
- 제네릭 의미있는 이름: `TItem`, `TResponse` (단독 `T`는 범용일 때만)
- `as` 타입 단언 최소화 → 타입 가드나 타입 추론
- `enum` 대신 `as const` 객체

```typescript
// Bad
const status: any = getStatus();
enum Color { Red, Blue }

// Good
const status: unknown = getStatus();
if (isValidStatus(status)) { /* type-safe */ }

const COLOR = { Red: 'red', Blue: 'blue' } as const;
type Color = typeof COLOR[keyof typeof COLOR];
```

## 타입 가드 패턴
```typescript
function isApiError(error: unknown): error is { code: string; message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}
```
