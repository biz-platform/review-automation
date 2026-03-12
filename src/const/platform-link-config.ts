/** 매장 관리 페이지용 플랫폼별 설명 2줄 (Figma 스타일 줄바꿈) */
export const STORE_PAGE_DESCRIPTION_LINES: Record<string, [string, string]> = {
  baemin: [
    "리뷰를 가져오려면 배달앱과 계정 연동이 필요해요",
    "배민비즈회원에 등록된 아이디와 비밀번호를 입력해주세요",
  ],
  coupang_eats: [
    "리뷰를 가져오려면 쿠팡이츠 스토어 계정 연동이 필요해요",
    "스토어 아이디와 비밀번호를 입력해주세요",
  ],
  yogiyo: [
    "리뷰를 가져오려면 요기요 사장님 계정 연동이 필요해요",
    "아이디와 비밀번호를 입력해주세요",
  ],
  ddangyo: [
    "리뷰를 가져오려면 땡겨요 사장님라운지 계정 연동이 필요해요",
    "아이디와 비밀번호를 입력해주세요",
  ],
};

export const PLATFORM_LINK_CONFIG: Record<
  string,
  {
    title: string;
    description: string;
    successMessage: string;
    placeholderId: string;
    placeholderPw: string;
  }
> = {
  baemin: {
    title: "배달의민족 (self.baemin.com) 연동",
    description:
      "사장님 계정으로 로그인하면 리뷰 수집·관리에 사용할 세션을 저장합니다.",
    successMessage:
      "매장이 연동되었습니다.\n\n최근 6개월 리뷰를 불러오는 중입니다.\n리뷰 관리 페이지에서 확인하세요.",
    placeholderId: "배민 사장님 아이디",
    placeholderPw: "비밀번호",
  },
  coupang_eats: {
    title: "쿠팡이츠 (store.coupangeats.com) 연동",
    description:
      "쿠팡이츠 스토어 계정으로 로그인하면 리뷰 수집·관리에 사용할 세션을 저장합니다.",
    successMessage:
      "매장이 연동되었습니다.\n\n최근 6개월 리뷰를 불러오는 중입니다.\n리뷰 관리 페이지에서 확인하세요.",
    placeholderId: "쿠팡이츠 스토어 아이디",
    placeholderPw: "비밀번호 (영문+숫자+특수문자, 8~15자)",
  },
  yogiyo: {
    title: "요기요 (ceo.yogiyo.co.kr) 연동",
    description:
      "요기요 사장님 사이트 계정으로 로그인하면 리뷰 수집·관리에 사용할 세션(vendor id·토큰)을 저장합니다.",
    successMessage:
      "매장이 연동되었습니다.\n\n최근 6개월 리뷰를 불러오는 중입니다.\n리뷰 관리 페이지에서 확인하세요.",
    placeholderId: "원아이디 (예: yogiyo99)",
    placeholderPw: "비밀번호",
  },
  ddangyo: {
    title: "땡겨요 (boss.ddangyo.com) 연동",
    description:
      "땡겨요 사장님라운지 계정으로 로그인하면 리뷰 수집·관리에 사용할 세션(patsto_no)을 저장합니다.",
    successMessage:
      "매장이 연동되었습니다.\n\n최근 6개월 리뷰를 불러오는 중입니다.\n리뷰 관리 페이지에서 확인하세요.",
    placeholderId: "아이디 또는 사업자등록번호",
    placeholderPw: "비밀번호",
  },
};
