# Git 워크플로우 상세

## 브랜치 전략 (간소화)
- `main`: 프로덕션 (항상 배포 가능 상태)
- `feat/기능명`: 기능 개발
- `fix/버그명`: 버그 수정
- `refactor/대상`: 리팩토링

## 커밋 컨벤션 (Conventional Commits)
```
feat: add user authentication with JWT
fix: resolve memory leak in WebSocket connection
refactor: extract API client into separate service
style: apply consistent spacing in dashboard layout
perf: optimize list rendering with virtualization
docs: update API endpoint documentation
chore: upgrade TanStack Query to v5
test: add integration tests for payment flow
```

## Bisectable Commits

각 커밋은 **독립적으로 이해 가능하고 revert 가능**해야 한다.

### 커밋 분리 순서
변경사항이 여러 영역에 걸칠 때, 논리적 의존 순서로 분리:
1. **인프라/설정** — tsconfig, package.json, 환경 설정
2. **타입/인터페이스** — 공유 타입 정의
3. **서비스/유틸** — API 클라이언트, 유틸리티 함수
4. **컴포넌트/페이지** — UI 구현
5. **테스트** — 테스트 추가/수정
6. **메타데이터** — 문서, CHANGELOG, 버전

### 분리 원칙
- **Rename은 동작 변경과 분리**: 이름 변경만의 커밋 → 로직 변경 커밋
- **테스트 인프라는 구현과 분리**: 테스트 헬퍼/설정 → 실제 테스트 → 구현 코드
- **리팩토링은 기능 추가와 분리**: 구조 변경 커밋 → 새 기능 커밋

## PR 규칙
- 제목은 커밋 컨벤션과 동일한 형식
- 본문에 Summary + Test Plan 포함
- Claude가 자동으로 PR 생성 및 관리
- `/ship` 스킬로 자동화된 파이프라인 사용 가능
