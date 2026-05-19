import * as yup from 'yup'

const passwordRules = yup
  .string()
  .required()
  .min(8)
  .matches(/[A-Za-z]/, 'password_letter')
  .matches(/[0-9]/, 'password_number')

export const signupSchema = yup
  .object({
    fullName: yup
      .string()
      .label('full_name')
      .transform((value) => (typeof value === 'string' ? value.trim() : value))
      .required()
      .min(2)
      .max(60),
    email: yup.string().label('email').required().email(),
    password: passwordRules.clone().label('password'),
    confirmPassword: yup
      .string()
      .label('confirm_password')
      .required()
      .oneOf([yup.ref('password')], 'password_match'),
  })
  .strict()

export const loginSchema = yup
  .object({
    email: yup.string().label('email').required().email(),
    password: yup.string().label('password').required(),
  })
  .strict()

export const forgotSchema = yup
  .object({
    email: yup.string().label('email').required().email(),
  })
  .strict()

export const resetSchema = yup
  .object({
    password: passwordRules.clone().label('password'),
    confirmPassword: yup
      .string()
      .label('confirm_password')
      .required()
      .oneOf([yup.ref('password')], 'password_match'),
  })
  .strict()

export const otpCodeSchema = yup
  .object({
    code: yup
      .string()
      .label('otp_code')
      .required()
      .matches(/^\d{8}$/, 'otp_format'),
  })
  .strict()

export type SignupInput = yup.InferType<typeof signupSchema>
export type LoginInput = yup.InferType<typeof loginSchema>
export type ForgotInput = yup.InferType<typeof forgotSchema>
export type ResetInput = yup.InferType<typeof resetSchema>
export type OtpCodeInput = yup.InferType<typeof otpCodeSchema>
