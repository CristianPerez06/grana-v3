// Non-authoritative reference. Exported from Paper (artboard "Signup — Desktop 1440").
// Hex values and `text-[15px]` literals here are Paper's defaults — do NOT copy verbatim.
// The shipped implementation uses tokens from @grana/ui-tokens via Tailwind utility classes.
// See ../design.md and apps/web/components/layout/auth-shell.tsx for the real source of truth.

export function SignupDesktopReference() {
  return (
    <div className="[font-synthesis:none] flex overflow-clip flex-col items-center justify-center p-12 relative bg-[#F6F7F9] antialiased">
      <div className="flex flex-col w-110 rounded-[20px] pt-11 pb-8 [box-shadow:#0B1A2B0A_0px_1px_2px,#0B1A2B0F_0px_12px_32px] bg-white border border-solid border-[#E6EAEF] px-10">
        <div className="flex flex-col items-center pb-7.5">
          {/* Grana logo (SVG omitted in reference — see signup-desktop-1440.svg) */}
          <div className="tracking-[-0.02em] mt-6.5 font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-bold text-[#0B1A2B] text-[26px]/8">
            Creá tu cuenta
          </div>
          <div className="mt-2 text-center font-['Plus_Jakarta_Sans',system-ui,sans-serif] flex justify-center flex-wrap text-[#6B7683] text-[15px]/5.5">
            Empezá a ver tu plata con claridad.
          </div>
        </div>
        <div className="flex flex-col w-full gap-4.5">
          <div className="flex flex-col w-full gap-1.75">
            <div className="font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-medium text-[#0B1A2B] text-[13px]/4">
              Email
            </div>
            <div className="flex items-center h-12 w-full rounded-xl px-3.75 shrink-0 bg-white border border-solid border-[#E6EAEF]">
              <div className="font-['Plus_Jakarta_Sans',system-ui,sans-serif] text-[#8A94A3] text-[15px]/4.5">
                tu@email.com
              </div>
            </div>
          </div>
          <div className="flex flex-col w-full gap-1.75">
            <div className="flex items-center justify-between w-full">
              <div className="font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-medium text-[#0B1A2B] text-[13px]/4">
                Contraseña
              </div>
              <div className="font-['Plus_Jakarta_Sans',system-ui,sans-serif] text-[#8A94A3] text-[13px]/4">
                Mínimo 8 caracteres
              </div>
            </div>
            <div className="flex items-center justify-between h-12 w-full rounded-xl px-3.75 shrink-0 bg-white border border-solid border-[#E6EAEF]">
              <div className="tracking-[0.14em] font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-bold text-[#0B1A2B] text-lg/5.5">
                ••••••••••
              </div>
              {/* Eye icon */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8A94A3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center h-12.5 w-full mt-7 rounded-xl gap-2 shrink-0 [box-shadow:#10B9813D_0px_6px_16px] bg-[#10B981]">
          <div className="tracking-[0.01em] font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-semibold text-white text-[15px]/4.5">
            Crear cuenta
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M5 12h14" />
            <path d="m13 6 6 6-6 6" />
          </svg>
        </div>
        <div className="flex items-center justify-center w-full mt-7 pt-6 gap-1.25 border-t border-t-solid border-t-[#EEF1F4]">
          <div className="font-['Plus_Jakarta_Sans',system-ui,sans-serif] text-[#6B7683] text-sm/4.5">
            ¿Ya tenés cuenta?
          </div>
          <div className="font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-semibold text-[#059669] text-sm/4.5">
            Iniciá sesión
          </div>
        </div>
      </div>
      <div className="absolute bottom-11 left-0 w-360 flex items-center justify-center gap-4.5">
        <div className="font-['Plus_Jakarta_Sans',system-ui,sans-serif] text-[#8A94A3] text-[13px]/4">Términos</div>
        <div className="w-0.75 h-0.75 rounded-full shrink-0 bg-[#C9D0D8]" />
        <div className="font-['Plus_Jakarta_Sans',system-ui,sans-serif] text-[#8A94A3] text-[13px]/4">Privacidad</div>
        <div className="w-0.75 h-0.75 rounded-full shrink-0 bg-[#C9D0D8]" />
        <div className="font-['Plus_Jakarta_Sans',system-ui,sans-serif] text-[#8A94A3] text-[13px]/4">Ayuda</div>
      </div>
    </div>
  );
}
