---
paths:
  - "**"
---

# 안전 규칙 (Safety Guardrails)

## 위험 명령 패턴

아래 패턴은 실행 전 반드시 사용자에게 경고하고 확인을 받아야 한다:

### 파일 삭제
- `rm -rf`, `rm -r`, `--recursive` 플래그가 포함된 삭제
- **안전 예외** (확인 없이 삭제 가능): `node_modules`, `.next`, `dist`, `build`, `__pycache__`, `.cache`, `.turbo`, `coverage`

### 데이터베이스
- `DROP TABLE`, `DROP DATABASE`, `TRUNCATE`
- 프로덕션 DB 연결 문자열이 포함된 명령

### Git 히스토리 변경
- `git push -f`, `git push --force`
- `git reset --hard`
- `git checkout -- .` (수정된 파일 덮어쓰기)
- `git clean -fd`

### 컨테이너/인프라
- `docker rm -f`, `docker system prune`
- 프로덕션 환경 배포 명령

## 원칙

- **되돌릴 수 없는 작업은 항상 확인**: 삭제, force push, hard reset
- **프로덕션 vs 개발 구분**: 환경변수, URL, 연결 문자열로 판별
- **단계적 실행**: 대량 삭제보다 개별 파일 지정 선호
- **git add -A / git add . 지양**: 민감한 파일(.env, credentials) 포함 위험
