import { z } from "zod";

/** 8~20자, 영문·숫자 포함, 공백 불가 (회원가입 Step3와 동일 규칙에서 공백 제거) */
export const findPasswordNewPasswordSchema = z
  .string()
  .min(8)
  .max(20)
  .regex(/^(?=.*[A-Za-z])(?=.*\d)[^\s]{8,20}$/, "8~20자, 영문과 숫자를 조합해 입력해주세요");
