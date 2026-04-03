---
paths:
  - "src/services/**"
  - "src/hooks/**"
---

# 에러 처리 패턴

## API 호출: Result 타입 패턴
```typescript
interface Result<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

async function fetchUser(id: string): Promise<Result<User>> {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) {
      return {
        success: false,
        error: { code: 'FETCH_ERROR', message: response.statusText },
      };
    }
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Network request failed' },
    };
  }
}
```

## React 컴포넌트: ErrorBoundary
- 페이지 단위 ErrorBoundary 배치
- fallback UI에 재시도 버튼 포함
- 에러 로깅 통합

## 원칙
- 외부 API 호출은 항상 Result 타입으로 래핑
- TanStack Query의 error 상태 적극 활용
- 사용자에게 보여줄 에러 메시지는 친화적으로

## Investigation-First 원칙

버그 수정 시 반드시 **근본 원인을 파악한 후** 수정을 시작한다.

### 3-Hypothesis Rule
1. 버그 증상 수집 → 가설 수립 → 로깅/단언으로 검증
2. 가설이 3회 연속 실패하면 **추측 반복을 중단**
3. 아키텍처 리뷰로 전환하거나 사용자에게 에스컬레이션

### Actionable Error Messages
에러 메시지는 **다음 단계를 안내**해야 한다:
```typescript
// Bad: 스택 트레이스만 노출
throw new Error('Failed to fetch');

// Good: 원인과 해결 방향 제시
return {
  success: false,
  error: {
    code: 'AUTH_EXPIRED',
    message: 'Session expired. Please sign in again.',
  },
};
```

### Scope Lock
가설이 형성되면 **해당 디렉토리/모듈만 편집**하여 scope creep 방지.
수정이 5개 파일을 초과하면 사용자에게 blast radius를 알리고 확인.
