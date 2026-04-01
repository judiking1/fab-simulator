---
paths:
  - "src/components/**"
  - "src/styles/**"
---

# 디자인 시스템 규칙

## 타이포그래피 스케일
```css
--font-display: 'Inter', system-ui, sans-serif;
--font-body: 'Inter', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', monospace;
```

| 용도 | Tailwind 클래스 | 크기 |
|------|-----------------|------|
| Hero | text-4xl font-bold | 36px |
| H1 | text-3xl font-bold | 30px |
| H2 | text-2xl font-semibold | 24px |
| H3 | text-xl font-semibold | 20px |
| Body | text-base | 16px |
| Small | text-sm | 14px |
| Caption | text-xs | 12px |

## 색상 시스템
- Tailwind 색상 팔레트 사용
- 시맨틱 색상 CSS 변수: primary, secondary, success, warning, error
- 다크모드: `dark:` variant 사용

## 간격 시스템
- Tailwind 기본 spacing (4px 단위)
- 컴포넌트 내부: `p-4` (16px)
- 섹션 간: `gap-6` (24px) 또는 `gap-8` (32px)

## 접근성 (a11y)
- 인터랙티브 요소에 ARIA 속성
- 키보드 네비게이션 지원
- 색상 대비 WCAG AA 이상
- `alt` 속성 필수
