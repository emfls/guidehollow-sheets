# GuideHollow Sheets 구현·검증 기록

기준일: 2026-10-24 (Asia/Seoul). 코드·로컬 검증과 공개 도메인 검증은 구분합니다.

## 실제 구현

- 신규 저장소 emfls/guidehollow-sheets에 Astro·TypeScript·Markdown 정적 사이트 구현.
- 독립 네이비·틸 디자인, 반응형 메뉴, 예제 표·데이터, 검색, 5개 카테고리, 가이드·도구·운영 정책·404 등 23개 HTML 페이지.
- 초기 영문 가이드 6편과 다운로드 가능한 원본 CSV, 공식 Microsoft/Google 출처, 글별 품질 기록.
- CSV Duplicate Checker: UTF-8/BOM/인용부호/쉼표/줄바꿈, 전체·선택 열 중복, 유지·제거 행, 처리 전후 수, 브라우저 내 다운로드. 2 MiB/20,000행/200열 제한을 공개.
- Formula Finder: 8개 함수, 앱·목적·검색 필터, 제품별 구문·입력·예상 결과·복사·공식 자료. 계산 엔진으로 표시하지 않음.
- canonical·구조화 데이터·OG 이미지·favicon·sitemap·robots·RSS·관련 글·내부 검색. 광고·분석·추적 스크립트 없음.

## 검증 증거

- `npm run check`: 오류 0, 경고 0, 힌트 0 (36파일).
- `npm test`: JavaScript 22개 통과. CSV 경계·잘못된 입력·공식 예제의 독립 계산/문자열 oracle 포함.
- `npm run test:publisher`: Python 38개 통과. 다른 사이트·잘못된 등록부·미승인·미래일·일일 제한·중복·빈 대기열·실패 배포·미지원 블록·링크/문자 보존·원고 변경·완료 후 재실행 보호 포함.
- `npm run build`: 23 HTML, 초기 가이드 6편, 내부 링크/자산 721개 검사 통과. 고유 metadata·canonical·sitemap·robots·RSS·검색·기본 접근성 검사 포함.
- 로컬 Chromium: 홈 데스크톱/390px 모바일 화면, 모바일 메뉴와 Escape, CSV 전체/선택 열 검사, 원본 001 보존 및 쉼표 포함 다운로드, 인용부호 오류와 결과 숨김 확인. 외부 업로드 요청 없음.
- Formula Finder: Google Sheets 전환, 검색, FILTER 복사, 0건, 초기화 확인. 모바일 가로 overflow 없음.
- Excel·Google Sheets 앱에서 직접 수식 계산 또는 XLSX 왕복 실행을 하지 않았음. 공식 구문 검토와 원본 fixture의 독립 JS 검증을 실제 앱 실행으로 주장하지 않음.

## 안전한 자동 발행

등록부의 gh-sheets·신규 저장소·도메인·언어·형식·시간대·일일 제한·워크플로·active를 검증하고, 해당 사이트에만 단일 Relation으로 연결된 승인된 도래 원고만 처리합니다. 슬러그/Notion ID/영속 ledger로 초기 글과 재실행 중복을 차단합니다. 미지원 블록과 원고 변경은 중단합니다. 비강제 push 후 Pages 워크플로를 명시 호출하고 정확한 SHA의 deploy 성공 및 공개 본문·canonical을 확인한 다음에만 Notion 완료를 기록합니다. 보호 브랜치는 우회하지 않습니다. 완료 기록 후 ledger 저장이 실패한 경우 원 발행일을 덮어쓰지 않고 수동 대조를 요구합니다.

## 실제 Notion 작업

- 기존 통합 대기열·등록부·학습 기록부를 사용. 별도 DB 생성 없음.
- gh-sheets 등록부 행: `402db4c0-a991-813e-9641-dcac9b1e46f5`, 상태 preparing 유지.
- 초기 원고 6행 생성(초안, 승인 false, 발행 예정/완료/게시 URL 미설정), 각 원고와 신규 사이트에 연결된 품질 기록 6행 생성.
- 기존 카테고리·상태를 보존하고 필요한 카테고리만 추가한 후 원 옵션 ID/색상/상태 보존을 재확인.
- Notion 커넥터가 원고 상대 링크를 app.notion.com으로 정규화하여, 새 사이트 절대 주소로 수정하고 재조회 검증.
- 파일별 실제 page ID와 quality ID: `docs/notion-bootstrap-map.json`. 초기 콘텐츠 frontmatter에도 ID를 보존하여 자동 재발행 차단.

## 외부 준비 상태 및 남은 작업

- 신규 저장소 GitHub Pages는 Actions 배포 방식·커스텀 도메인 sheets.guidehollow.com을 등록함.
- 현재 DNS CNAME/A 미응답. 도메인 홈페이지·HTTPS·실제 404·모바일 실서비스·공개 canonical 검증은 미완료.
- DNS 관리자: CNAME Host `sheets`, Value `emfls.github.io`. 프로토콜이나 저장소 경로를 넣지 않음. DNS 전파 후 Pages HTTPS 발급/Enforce HTTPS 확인.
- 신규 저장소 Actions 시크릿 목록은 비어 있음. NOTION_API_TOKEN 미설정이므로 실제 Actions→Notion API 연결·발행은 미검증. 세 기존 DB를 해당 integration에 공유하고 신규 저장소 Secret에만 토큰 설정.
- DNS·HTTPS·권한·공개 검증이 끝난 뒤 실제 최초 공개일을 반영하고, 등록부를 active로 전환한 후 수동 발행 경로 검증. 준비일을 과거 공개일로 조작하지 않음.
- cron-job.org 예약은 생성/활성화하지 않음. 기존 GuideHollow 오전 9:30 예약·코드·배포, EMFLS 저장소·대기열·cron은 변경하지 않음.
- 검색엔진 등록 및 실제 성과, 광고 적용은 별도 운영 단계이며 승인·순위 보장 없음.

GitHub PR·CI·배포 결과는 실행 후 아래에 추가합니다.
