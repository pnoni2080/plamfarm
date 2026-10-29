// 팜팜(Palm Farm) 게임 데이터 — 인쇄용 PDF(말판·푸드카드·레시피차트·찬스카드·특수카드)에서 옮겨 적은 값
// 금액 단위는 모두 '원'

const MAN = 10000;

// 푸드카드 24장: 가격, 제철, 시설 설립 비용[밭, 가공시설, 교육농장], 견학요금표[대지료, 밭, 가공시설, 교육농장]
const FARMS = {
  bean:        { name: '콩',     en: 'bean',          season: '9월 ~ 10월',    price: 5 * MAN,   build: [5, 15, 25],    rent: [0.2, 3, 9, 25] },
  onion:       { name: '양파',   en: 'onion',         season: '7월 ~ 9월',     price: 8 * MAN,   build: [5, 15, 25],    rent: [0.4, 6, 18, 45] },
  apple:       { name: '사과',   en: 'apple',         season: '10월 ~ 12월',   price: 8 * MAN,   build: [5, 15, 25],    rent: [0.4, 6, 18, 45] },
  cucumber:    { name: '오이',   en: 'cucumber',      season: '4월 ~ 7월',     price: 10 * MAN,  build: [5, 15, 25],    rent: [0.6, 9, 27, 55] },
  tomato:      { name: '토마토', en: 'tomato',        season: '7월 ~ 9월',     price: 10 * MAN,  build: [5, 15, 25],    rent: [0.6, 9, 27, 60] },
  rice:        { name: '쌀',     en: 'rice',          season: '연중 계속',     price: 12 * MAN,  build: [5, 15, 25],    rent: [0.8, 10, 30, 60] },
  greens:      { name: '산채',   en: 'vegetables',    season: '연중 계속',     price: 14 * MAN,  build: [10, 30, 50],   rent: [1, 15, 45, 75] },
  garlic:      { name: '마늘',   en: 'garlic',        season: '8월 ~ 10월',    price: 16 * MAN,  build: [10, 30, 50],   rent: [1.2, 18, 50, 90] },
  sweetpotato: { name: '고구마', en: 'sweet potato',  season: '8월 ~ 10월',    price: 16 * MAN,  build: [10, 30, 50],   rent: [1.2, 18, 50, 90] },
  potato:      { name: '감자',   en: 'potato',        season: '6월 ~ 10월',    price: 18 * MAN,  build: [10, 30, 50],   rent: [1.4, 20, 55, 95] },
  persimmon:   { name: '감',     en: 'persimmon',     season: '10월',          price: 18 * MAN,  build: [10, 30, 50],   rent: [1.4, 20, 55, 95] },
  pepper:      { name: '고추',   en: 'pepper',        season: '6월 ~ 11월',    price: 20 * MAN,  build: [10, 30, 50],   rent: [1.6, 22, 60, 100] },
  insect:      { name: '곤충',   en: 'insect',        season: '9월 ~ 11월',    price: 22 * MAN,  build: [15, 45, 75],   rent: [1.8, 25, 70, 105] },
  chives:      { name: '부추',   en: 'chives',        season: '3월 ~ 9월',     price: 24 * MAN,  build: [15, 45, 75],   rent: [2, 30, 75, 110] },
  pear:        { name: '배',     en: 'pear',          season: '9월 ~ 11월',    price: 24 * MAN,  build: [15, 45, 75],   rent: [2, 30, 75, 110] },
  grape:       { name: '포도',   en: 'grape',         season: '7월 ~ 8월',     price: 26 * MAN,  build: [15, 45, 75],   rent: [2.2, 33, 80, 115] },
  blueberry:   { name: '블루베리', en: 'blueberry',   season: '7월 ~ 9월',     price: 26 * MAN,  build: [15, 45, 75],   rent: [2.2, 33, 80, 115] },
  watermelon:  { name: '수박',   en: 'watermelon',    season: '7월 ~ 8월',     price: 28 * MAN,  build: [15, 45, 75],   rent: [2.4, 36, 85, 120] },
  peach:       { name: '복숭아', en: 'peach',         season: '6월 ~ 8월',     price: 30 * MAN,  build: [20, 60, 100],  rent: [2.6, 39, 90, 127] },
  honey:       { name: '꿀',     en: 'honey',         season: '연중 계속(양봉)', price: 32 * MAN, build: [20, 60, 100],  rent: [2.8, 45, 100, 140] },
  melon:       { name: '멜론',   en: 'melon',         season: '7월 ~ 9월',     price: 32 * MAN,  build: [20, 60, 100],  rent: [2.8, 45, 100, 140] },
  strawberry:  { name: '딸기',   en: 'strawberry',    season: '1월 ~ 5월',     price: 35 * MAN,  build: [20, 60, 100],  rent: [3.5, 50, 110, 150] },
  ginseng:     { name: '인삼',   en: 'ginseng',       season: '6월 ~ 8월',     price: 35 * MAN,  build: [20, 60, 100],  rent: [3.5, 50, 110, 150] },
  hanwoo:      { name: '한우',   en: 'Korean beef',   season: '국내산 1등급 소', price: 100 * MAN, build: [40, 80, 120], rent: [5, 70, 140, 200] },
};
for (const f of Object.values(FARMS)) {
  f.build = f.build.map(v => Math.round(v * MAN));
  f.rent = f.rent.map(v => Math.round(v * MAN));
}

const FACILITY = ['대지', '밭', '가공시설', '교육농장'];
const FACILITY_ICON = [null, 'field', 'factory', 'eduFarm'];

// 말판 40칸 — 출발지(0)에서 아래쪽 줄을 따라 왼쪽으로
const BOARD = [
  { t: 'start',    name: '출발지(서울)' },
  { t: 'farm', id: 'bean' }, { t: 'chance' }, { t: 'farm', id: 'onion' }, { t: 'farm', id: 'apple' },
  { t: 'expo',     name: '농업기술박람회' },
  { t: 'farm', id: 'cucumber' }, { t: 'chance' }, { t: 'farm', id: 'tomato' }, { t: 'farm', id: 'rice' },
  { t: 'disaster', name: '자연재해' },
  { t: 'farm', id: 'greens' }, { t: 'chance' }, { t: 'farm', id: 'garlic' }, { t: 'farm', id: 'sweetpotato' },
  { t: 'market',   name: '직거래장터' },
  { t: 'farm', id: 'potato' }, { t: 'chance' }, { t: 'farm', id: 'persimmon' }, { t: 'farm', id: 'pepper' },
  { t: 'center',   name: '농업기술센터' },
  { t: 'farm', id: 'insect' }, { t: 'chance' }, { t: 'farm', id: 'chives' }, { t: 'farm', id: 'pear' },
  { t: 'market',   name: '직거래장터' },
  { t: 'farm', id: 'grape' }, { t: 'farm', id: 'blueberry' },
  { t: 'heritage', name: '국가중요농업유산' },
  { t: 'farm', id: 'watermelon' },
  { t: 'local',    name: '로컬푸드매장' },
  { t: 'farm', id: 'peach' },
  { t: 'salt',     name: '염전(소금)' },
  { t: 'farm', id: 'honey' }, { t: 'farm', id: 'melon' }, { t: 'chance' },
  { t: 'farm', id: 'strawberry' }, { t: 'farm', id: 'ginseng' },
  { t: 'fund',     name: '농촌발전기금' },
  { t: 'farm', id: 'hanwoo' },
];
BOARD.forEach((s, i) => { if (s.t === 'farm') FARMS[s.id].pos = i; if (s.t === 'chance') s.name = '찬스카드'; });

// 라인독점: 한 줄의 푸드카드 6장
const LINES = [
  { name: '첫째 줄', farms: ['bean', 'onion', 'apple', 'cucumber', 'tomato', 'rice'] },
  { name: '둘째 줄', farms: ['greens', 'garlic', 'sweetpotato', 'potato', 'persimmon', 'pepper'] },
  { name: '셋째 줄', farms: ['insect', 'chives', 'pear', 'grape', 'blueberry', 'watermelon'] },
  { name: '넷째 줄', farms: ['peach', 'honey', 'melon', 'strawberry', 'ginseng', 'hanwoo'] },
];
LINES.forEach((l, i) => l.farms.forEach(id => { FARMS[id].line = i; }));

// 로컬푸드매장 특수재료(각 3개) + 소금(7개)
const SPECIALS = {
  sugar:     { name: '설탕' },
  gochujang: { name: '고추장' },
  bacon:     { name: '베이컨' },
  ginger:    { name: '생강' },
  cheese:    { name: '치즈' },
  milk:      { name: '우유' },
  doenjang:  { name: '된장' },
};
const SPECIAL_STOCK = 3;
const SALT_STOCK = 7;
const SPECIAL_PRICE = 25 * MAN;

// 레시피차트 7장
const RECIPES = {
  bibimbap:    { name: '한우산채비빔밥', foods: ['hanwoo', 'greens', 'rice', 'cucumber', 'bean'], special: 'gochujang', salt: true },
  insectpasta: { name: '곤충파스타',     foods: ['insect', 'pepper', 'tomato', 'onion', 'garlic'], special: 'bacon', salt: true },
  hwachae:     { name: '과일화채',       foods: ['watermelon', 'grape', 'persimmon', 'melon', 'strawberry'], special: 'milk', salt: false },
  healthjuice: { name: '건강즙',         foods: ['ginseng', 'honey', 'pear', 'onion', 'garlic'], special: 'ginger', salt: false },
  jam:         { name: '과일잼 세트',    foods: ['apple', 'strawberry', 'peach', 'grape', 'blueberry'], special: 'sugar', salt: false },
  doenjangguk: { name: '소고기된장국',   foods: ['hanwoo', 'greens', 'potato', 'chives', 'pepper'], special: 'doenjang', salt: true },
  gratin:      { name: '고구마그라탕',   foods: ['sweetpotato', 'bean', 'tomato', 'potato', 'onion'], special: 'cheese', salt: true },
};

// 찬스카드 30장
const CHANCE = {
  1:  { title: '병해충의 공격', text: '작물들이 병해충의 공격을 받았습니다.', act: '병해충 방제비용으로 5만원을 은행에 납부합니다.' },
  2:  { title: '우수농촌 진로체험처', text: '우수농촌 진로체험처로 채택되어 사업비를 받습니다.', act: '사업비 20만원을 은행에서 받습니다.' },
  3:  { title: '기청제 거행', text: '장마가 연일 계속되어 제사를 지냅니다. 자연재해에 갇혀 있을 때 사용할 수 있고, 1회 사용 후 반납합니다. 다른 사람에게 20만원에 팔 수 있습니다.', act: '자연재해 지역을 빠져나갈 수 있도록 보관합니다.', keep: true },
  4:  { title: '태풍이다!', text: '자연재해로 심각한 피해를 입었습니다. 출발지를 지나더라도 농촌지원금을 받을 수 없습니다.', act: '자연재해 칸으로 이동합니다.' },
  5:  { title: '신지식 농업인 상', text: '새로운 지식이나 기술을 활용(창의성)하고 습득한 지식을 농업인에게 적극 전파(실천성)하여 지역 농업·농촌에 공헌(사회공헌성)하였습니다.', act: '상금 30만원을 받습니다.' },
  6:  { title: '관광 농장 체험', text: '관광 농장 체험으로 염전을 방문합니다. 출발지를 지나면 농촌지원금을 받습니다.', act: '염전으로 이동합니다.' },
  7:  { title: '농약 허용물질 목록관리제도 : PLS', text: '농약 허용물질 목록관리제도(Positive List System)의 잔류 허용기준치는 0.01ppm(mg/kg)입니다. 농약 허용치를 초과하여 벌금을 내게 됩니다.', act: '범칙금 5만원을 은행에 납부합니다.' },
  8:  { title: '해외연수', text: '해외의 농업 전문대학교에 연수를 가게 되었습니다.', act: '등록금 10만원을 은행에 납부합니다.' },
  9:  { title: '농지 연금 혜택', text: '농지 연금 혜택을 받으세요.', act: '연금 10만원을 은행에서 받습니다.' },
  10: { title: '농산물 유통', text: '농산물 배달 임무를 맡았습니다.', act: '뒤로 세 칸 옮기세요.' },
  11: { title: '농산물 특송', text: '농산물 특송을 위하여 서울로 돌아갑니다. 출발지에서 농촌지원금을 받을 수 있습니다.', act: '출발지로 이동합니다.' },
  12: { title: '농식품 경진대회', text: '농식품 경진대회에서 우승하였습니다.', act: '상금 10만원을 은행에서 받습니다.' },
  13: { title: '우대권', text: '1회 사용 후 찬스카드함에 반납합니다.', act: '상대방이 소유한 장소에 견학비용 없이 머무를 수 있습니다.', keep: true },
  14: { title: '농업기술박람회 참가', text: '참가비 30만원을 박람회 개최자에게 냅니다. 개최자가 없으면 개최하거나 그냥 지나갈 수 있습니다. 출발지를 지나면 농촌지원금을 받습니다.', act: '농업기술박람회 칸으로 이동합니다.' },
  15: { title: '낡은시설 고쳐쓰자', text: '정기적으로 시설을 수리하여야 합니다. (교육농장 8만원 · 가공시설 5만원 · 밭 3만원, 두 번째 바퀴부터 효력)', act: '수리비를 건물별로 은행에 납부하세요.', lap2: true },
  16: { title: '야생동물 출현', text: '야생동물들이 농작물에 피해를 줬습니다. (교육농장 8만원 · 가공시설 5만원 · 밭 3만원, 두 번째 바퀴부터 효력)', act: '복구 비용을 은행에 지불하세요.', lap2: true },
  17: { title: '농촌마을 딸기축제로!', text: '딸기 농장을 다른 사람이 가지고 있으면 축제 참가비 25만원을 냅니다. 출발지를 지나면 농촌지원금을 받습니다.', act: '축제가 열리는 딸기 농장으로 가세요.' },
  18: { title: '도심여행', text: '서울로 여행을 떠납니다.', act: '서울(출발지)로 가세요.' },
  19: { title: '단오제 의식', text: '음력 5월 5일에 단오제 제사를 올리고 축제를 열어 풍년이 들었습니다.', act: '모든 친구에게 축하금을 1만원씩 받습니다.' },
  20: { title: '친환경 농산물 재배 장려금 혜택', text: '친환경 농산물 재배 인증을 받아 농업 장려금 혜택을 받았습니다.', act: '장려금 10만원을 은행에서 받으세요.' },
  21: { title: '종합소득세', text: '종합소득세를 냅니다. (교육농장 8만원 · 가공시설 5만원 · 밭 3만원, 두 번째 바퀴부터 효력)', act: '종합소득세를 시설별로 은행에 납부하세요.', lap2: true },
  22: { title: '세계중요농업유산', text: '세계중요농업유산으로 채택되었습니다.', act: '수상금 30만원을 은행에서 받습니다.' },
  23: { title: '로컬푸드', text: '원하는 재료를 구입할 수 있습니다.', act: '로컬푸드매장으로 가세요.' },
  24: { title: '농장매각', text: '시설이 지어진 경우 시설도 반값으로 함께 처분합니다.', act: '가지고 있는 농장 중에서 가장 비싼 곳을 반값에 은행에 파세요.' },
  25: { title: '우대권', text: '1회 사용 후 찬스카드함에 반납합니다.', act: '상대방이 소유한 장소에 견학비용 없이 머무를 수 있습니다.', keep: true },
  26: { title: '직거래장터', text: '가진 푸드카드 중 한 장을 경매해야 합니다. 시설이 있으면 함께 경매합니다.', act: '직거래장터로 가세요.' },
  27: { title: '전국농장여행', text: '축하합니다. 전국여행권을 얻었네요. 다른 곳으로 갈 수 없습니다. 출발지를 지나면 농촌지원금을, 농업기술센터를 지나면 모아 놓은 기금을 받습니다.', act: '현재 위치에서 한 바퀴 돌아오세요.' },
  28: { title: '농촌발전기금 배당', text: '출발지를 지나면 농촌지원금을 받습니다.', act: '농업기술센터로 가세요.' },
  29: { title: '농장매각', text: '시설이 지어진 경우 시설도 반값으로 함께 처분합니다.', act: '가지고 있는 농장 중에서 가장 비싼 곳을 반값에 은행에 파세요.' },
  30: { title: '드론 조종 신기술 획득!', text: '드론 조종사 국가자격증을 취득하였습니다. 드론을 이용한 농작물 방역을 실시하여 토양이 비옥해졌습니다.', act: '내가 고른 농장 한 곳의 견학요금이 2배가 됩니다.' },
};

// 국가중요농업유산 (KIAHS)
const HERITAGE = [
  '완도 청산도 구들장논', '제주 밭담', '구례 산수유농업', '담양 대나무밭', '금산 인삼농업', '하동 전통차농업',
  '울진 금강송 산지농업', '부안 유유동 양잠농업', '울릉도 화산섬 밭농업', '의성 전통수리 농업시스템',
  '보성 전통차 농업시스템', '장흥 발효차 청태전 농업시스템',
];

const PLAYER_STYLES = [
  { color: '#E9A72B', avatar: 'farmer1', label: '노랑' },
  { color: '#CF3F2C', avatar: 'farmer2', label: '빨강' },
  { color: '#2E6B3A', avatar: 'farmer3', label: '초록' },
  { color: '#3C9BAA', avatar: 'farmer4', label: '하늘' },
];

const SALARY = 20 * MAN;
const FUND_DONATION = 15 * MAN;
const EXPO_PRICE = 50 * MAN;
const EXPO_FEE = 30 * MAN;
const SALT_FARM_PRICE = 40 * MAN;
const SALT_PRICE = 20 * MAN;
const HERITAGE_PRIZE = 20 * MAN;
const LOAN_MAX = 100 * MAN;
const START_CASH = 293 * MAN; // 50만×3, 10만×10, 5만×5, 2만×5, 1만×5, 5천×5, 1천×5
