# 상세 사용 가이드

> 코드를 모르는 사람도 따라할 수 있는 단계별 설명서입니다.
> 예시: "롤러코스터 타이쿤 웹 버전"을 만드는 상황으로 설명합니다.

---

## 목차

1. [사전 준비](#1-사전-준비)
2. [보일러플레이트 가져오기](#2-보일러플레이트-가져오기)
3. [내 프로젝트에 맞게 수정하기](#3-내-프로젝트에-맞게-수정하기)
4. [Claude Code로 프로젝트 시작하기](#4-claude-code로-프로젝트-시작하기)
5. [개발하기](#5-개발하기)
6. [코드 리뷰 & QA](#6-코드-리뷰--qa)
7. [배포하기](#7-배포하기)

---

## 1. 사전 준비

### 필수 설치 항목

#### 1-1. Node.js (v18 이상)
- 다운로드: https://nodejs.org/
- 설치 확인: 터미널에서 `node --version` 입력

#### 1-2. pnpm (패키지 매니저)
```bash
npm install -g pnpm
```

#### 1-3. Git
- 다운로드: https://git-scm.com/

#### 1-4. Claude Code
- 설치 가이드: https://docs.anthropic.com/en/docs/claude-code/overview

---

## 2. 프로젝트 시작

```bash
mkdir my-project && cd my-project && git init
claude
> /project-kickoff my-project
```

---

## 3. 개발 워크플로우

일반 대화로 기능 구현 → `/review` → `/qa` → `/ship`

---

## 4. 스킬 레퍼런스

상세 내용은 [quick-start.md](quick-start.md) 참조.
