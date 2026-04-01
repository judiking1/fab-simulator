---
paths:
  - "src/components/**"
  - "src/pages/**"
---

# 컴포넌트 패턴 규칙

## 컴포넌트 작성
```typescript
// function 선언 (hoisting, DevTools 가독성)
interface UserCardProps {
  user: User;
  onSelect: (id: string) => void;
}

function UserCard({ user, onSelect }: UserCardProps): React.ReactElement {
  const handleClick = () => {
    onSelect(user.id);
  };

  return <div onClick={handleClick}>{user.name}</div>;
}

export default UserCard;
```

## 원칙
- Props destructuring in parameter
- default export: 페이지 컴포넌트 / named export: 재사용 컴포넌트
- 컴포넌트 당 하나의 파일
- 150줄 초과 시 분리 검토
- Props 타입명: `컴포넌트명Props`

## Import 순서
```typescript
// 1. React 및 외부 라이브러리
import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';

// 2. 내부 모듈 (@ alias)
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';

// 3. 상대 경로 모듈
import { formatName } from './utils';

// 4. 타입 (type-only imports)
import type { User } from '@/types/user';

// 5. 스타일/에셋
import './styles.css';
```

> Biome의 `organizeImports`가 자동 정렬합니다.
