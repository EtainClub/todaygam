# 오늘감

결과가 나오기 전에 직감을 기록하고, 시간이 쌓이면 우연과 구분되는지 보여주는 개인 기록 PWA입니다.

## 구현 범위

- 3단계 온보딩과 고정 질문 3개 선택
- 답과 세기를 고르는 즉시 SHA-256 해시와 함께 잠금
- 자유 감 하루 3개, 결과 판정 및 선택 메모
- 전날 미확인 기록 1회 안내
- 질문별 2×2 분할표, 차이값, 표본 게이트, 세기별 통계
- 달력과 `?d=YYYY-MM-DD` 기록 시트
- 알림/질문/계정/시간대/JSON 내보내기/전체 삭제 설정
- 익명 Firebase Auth, Firestore 오프라인 캐시와 실시간 동기화
- 통합 서비스 워커(앱 셸 캐시, FCM, 알림 액션 큐)
- Cloud Functions 통계 rollup, 시간대별 알림, 계정 삭제
- Firestore 규칙·인덱스와 17개 보안 규칙 테스트

Firebase 환경 키가 없을 때는 브라우저 `localStorage`를 사용하는 로컬 모드로 완전히 동작합니다. 키를 넣으면 같은 UI가 Firebase 동기화 모드로 전환됩니다.

## 로컬 실행

Node 22 LTS와 pnpm을 권장합니다.

```bash
cp .env.example .env.development.local
pnpm install
pnpm dev
```

현재 저장소는 `output: "export"`를 사용합니다. 이 Android/ARM64 개발 컨테이너에는 Turbopack 네이티브 바인딩이 없어 Next 16 공식 폴백인 webpack 플래그를 스크립트에 포함했습니다.

## 검증

```bash
pnpm lint
pnpm test
pnpm --dir functions build
pnpm --dir functions test
pnpm build
pnpm test:rules
```

`pnpm test:rules`는 Java 21+와 Firestore Emulator가 필요합니다. 규칙 테스트는 문장/답/세기 불변, 단 한 번의 판정, 소프트 삭제, rollup 쓰기 차단 등 설계서의 17개 시나리오를 모두 다룹니다.

## Firebase 에뮬레이터

```bash
firebase emulators:start
pnpm seed:emulator
```

`seed:emulator`는 `demo-user`에 60일 × 3개 기록을 만들고, 연락 질문에는 신호가, 비 질문에는 노이즈가 나타나도록 구성합니다.

공개 질문 카탈로그를 개발/운영 프로젝트에 넣을 때:

```bash
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
GCLOUD_PROJECT=oneulgam-dev \
pnpm seed:config
```

서비스 계정 파일과 `.env*`는 git에서 제외됩니다.

## 배포

```bash
pnpm deploy:dev
pnpm deploy:prod
```

Firebase Hosting은 `out/`을 제공하며 서비스 워커와 설정 파일에는 `no-store`, 정적 Next 자산에는 immutable 캐시가 적용됩니다. 실제 배포 전에는 `.firebaserc` 프로젝트 ID, Firebase 웹 키, VAPID 키, reCAPTCHA 사이트 키를 실제 프로젝트 값으로 바꾸세요.

실환경에서 별도로 확인해야 하는 항목은 설계서와 같습니다: App Check 적용 전후, Android 알림 액션, iOS 홈 화면 PWA 푸시, 비행기 모드 동기화, 자정 경계, 커스텀 도메인과 승인 도메인입니다.
