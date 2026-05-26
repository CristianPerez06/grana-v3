/*
 * ⚠️ MOCKUP NO-AUTORITATIVO — referencia de diseño, NO implementación.
 * Export crudo de Paper (archivo "Grana V3 — Desktop", artboard "Dashboard — Desktop 1440").
 * - Usa hex LITERALES (#10B981, #0B1A2B, …), NO los tokens de @grana/ui-tokens.
 * - Datos de ejemplo (montos, nombres). Iconos SVG inline.
 * - La implementación real vive en apps/web con Server Components, clases de token
 *   (bg-emerald, text-navy, …) y componentes por plataforma. Ver README.md.
 */
(
    <div className="[font-synthesis:none] flex overflow-clip w-360 h-fit p-3 bg-[#F6F7F9] antialiased text-xs/4">
      <div className="flex flex-col [width:256px] rounded-3xl py-5.5 px-4 shrink-0 [box-shadow:#1A17140D_0px_1px_2px] bg-white border border-solid border-[#EEF1F4]">
        <div className="flex items-center pt-1.5 pb-5.5 shrink-0 px-2.5">
          <div className="tracking-[-0.03em] inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-bold text-[#0B1A2B] text-[26px]/8">
            grana
          </div>
        </div>
        <div className="flex flex-col gap-1 grow basis-[0%] min-h-0 justify-start overflow-clip">
          <div className="flex items-center rounded-2xl py-2.75 px-3 gap-3 bg-[#10B98114]">
            <div className="shrink-0 flex items-center justify-center size-5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" overflow="visible" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                <rect x="3" y="3" width="7" height="9" rx="1" overflow="visible" />
                <rect x="14" y="3" width="7" height="5" rx="1" overflow="visible" />
                <rect x="14" y="12" width="7" height="9" rx="1" overflow="visible" />
                <rect x="3" y="16" width="7" height="5" rx="1" overflow="visible" />
              </svg>
            </div>
            <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-semibold text-[#10B981] text-[15px]/4.5">
              Inicio
            </div>
          </div>
          <div className="flex items-center rounded-2xl py-2.75 px-3 gap-3">
            <div className="shrink-0 flex items-center justify-center size-5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B1A2B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" overflow="visible" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                <path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" overflow="visible" />
                <path d="M21 7H7a2 2 0 0 0 0 8h14v-8z" overflow="visible" />
                <circle cx="16" cy="11" r="1" overflow="visible" />
              </svg>
            </div>
            <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-medium text-[#0B1A2B] text-[15px]/4.5">
              Cuentas
            </div>
          </div>
          <div className="flex items-center rounded-2xl py-2.75 px-3 gap-3">
            <div className="shrink-0 flex items-center justify-center size-5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B1A2B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" overflow="visible" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                <rect x="2" y="5" width="20" height="14" rx="2" overflow="visible" />
                <path d="M2 10h20" overflow="visible" />
              </svg>
            </div>
            <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-medium text-[#0B1A2B] text-[15px]/4.5">
              Tarjetas
            </div>
          </div>
          <div className="flex items-center rounded-2xl py-2.75 px-3 gap-3">
            <div className="shrink-0 flex items-center justify-center size-5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B1A2B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" overflow="visible" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                <line x1="8" y1="6" x2="21" y2="6" overflow="visible" />
                <line x1="8" y1="12" x2="21" y2="12" overflow="visible" />
                <line x1="8" y1="18" x2="21" y2="18" overflow="visible" />
                <line x1="3" y1="6" x2="3.01" y2="6" overflow="visible" />
                <line x1="3" y1="12" x2="3.01" y2="12" overflow="visible" />
                <line x1="3" y1="18" x2="3.01" y2="18" overflow="visible" />
              </svg>
            </div>
            <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-medium text-[#0B1A2B] text-[15px]/4.5">
              Movimientos
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <div className="h-px self-stretch shrink-0 bg-[#EEF1F4]" />
          <div className="flex items-center mt-2 rounded-2xl py-2.75 px-3 gap-3">
            <div className="shrink-0 flex items-center justify-center size-5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B1A2B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" overflow="visible" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                <circle cx="12" cy="12" r="3" overflow="visible" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" overflow="visible" />
              </svg>
            </div>
            <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-medium text-[#0B1A2B] text-[15px]/4.5">
              Configuración
            </div>
          </div>
          <div className="flex items-center rounded-2xl py-2.75 px-3 gap-3">
            <div className="shrink-0 flex items-center justify-center size-5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8A94A3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" overflow="visible" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" overflow="visible" />
                <polyline points="16 17 21 12 16 7" overflow="visible" />
                <line x1="21" y1="12" x2="9" y2="12" overflow="visible" />
              </svg>
            </div>
            <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-medium text-[#8A94A3] text-[15px]/4.5">
              Cerrar sesión
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col pt-6 pb-9 gap-5 px-9">
        <div className="flex items-end justify-between gap-6">
          <div className="flex flex-col gap-1">
            <div className="tracking-[-0.02em] inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-bold text-[#0B1A2B] text-3xl/9">
              Hola, Cristian.
            </div>
            <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-medium text-[#6B7683] text-sm/4.5">
              Martes 26 de mayo
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center h-10.5 rounded-xl px-3.5 gap-2 bg-white border border-solid border-[#E6EAEF]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7683" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" overflow="visible" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" overflow="visible" />
                <circle cx="12" cy="12" r="3" overflow="visible" />
              </svg>
              <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-medium text-[#6B7683] text-sm/4.5">
                Ocultar importes
              </div>
            </div>
            <div className="flex items-center h-10.5 rounded-xl px-4.5 gap-2 [box-shadow:#1A17140D_0px_1px_2px] bg-[#10B981]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" overflow="visible" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                <line x1="12" y1="5" x2="12" y2="19" overflow="visible" />
                <line x1="5" y1="12" x2="19" y2="12" overflow="visible" />
              </svg>
              <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-semibold text-white text-sm/4.5">
                Nuevo movimiento
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-2xl py-6.5 px-7 gap-8 [box-shadow:#1A17140D_0px_1px_2px] bg-white border border-solid border-[#E6EAEF]">
          <div className="flex flex-col gap-1.5">
            <div className="tracking-[0.08em] uppercase inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-semibold text-[#6B7683] text-xs/4">
              Para gastar
            </div>
            <div className="tracking-[-0.03em] inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-bold text-[#0B1A2B] text-5xl/13.5">
              $ 1.284.500
            </div>
            <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-medium text-[#6B7683] text-[15px]/4.5">
              US$ 2.150 disponibles
            </div>
          </div>
          <div className="flex flex-col w-75 shrink-0 pl-8 gap-2.5 border-l border-l-solid border-l-[#EEF1F4]">
            <div className="flex items-center gap-2.5">
              <div className="w-7.5 h-7.5 shrink-0 flex items-center justify-center rounded-[9px] bg-[#ECFDF5]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" overflow="visible" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                  <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" overflow="visible" />
                  <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" overflow="visible" />
                  <path d="M18 12a2 2 0 0 0 0 4h4v-4z" overflow="visible" />
                </svg>
              </div>
              <div className="grow basis-[0%] inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-medium text-[#0B1A2B] text-sm/4.5">
                Billetera
              </div>
              <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-semibold text-[#0B1A2B] text-sm/4.5">
                $ 312.400
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-7.5 h-7.5 shrink-0 flex items-center justify-center rounded-[9px] bg-[#EAF1F6]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3A6B8A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" overflow="visible" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                  <path d="M3 21h18" overflow="visible" />
                  <path d="M5 21V10l7-5 7 5v11" overflow="visible" />
                  <path d="M9 21v-6h6v6" overflow="visible" />
                </svg>
              </div>
              <div className="grow basis-[0%] inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-medium text-[#0B1A2B] text-sm/4.5">
                Banco Galicia
              </div>
              <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-semibold text-[#0B1A2B] text-sm/4.5">
                $ 972.100
              </div>
            </div>
            <div className="flex items-center pt-0.5 gap-1.25">
              <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-semibold text-[#10B981] text-[13px]/4">
                Ver todas las cuentas
              </div>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" overflow="visible" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                <line x1="5" y1="12" x2="19" y2="12" overflow="visible" />
                <polyline points="12 5 19 12 12 19" overflow="visible" />
              </svg>
            </div>
          </div>
        </div>
        <div className="flex items-start gap-5">
          <div className="flex flex-col grow basis-[0%] min-w-0 gap-5">
            <div className="flex flex-col rounded-2xl p-6 gap-5 grow basis-[0%] [box-shadow:#1A17140D_0px_1px_2px] bg-white border border-solid border-[#E6EAEF]">
              <div className="flex items-center justify-between">
                <div className="tracking-[-0.01em] inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-semibold text-[#0B1A2B] text-lg/5.5">
                  Balance del mes
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center justify-center rounded-[9px] shrink-0 border border-solid border-[#E6EAEF] size-8">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7683" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" overflow="visible" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                      <polyline points="15 18 9 12 15 6" overflow="visible" />
                    </svg>
                  </div>
                  <div className="min-w-22 text-center inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-semibold text-[#0B1A2B] text-sm/4.5">
                    Mayo 2026
                  </div>
                  <div className="flex items-center justify-center rounded-[9px] shrink-0 border border-solid border-[#E6EAEF] size-8">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7683" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" overflow="visible" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                      <polyline points="9 18 15 12 9 6" overflow="visible" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="flex items-end justify-between h-43 pt-1 gap-4.5 grow basis-[0%] min-h-43 px-1">
                <div className="flex flex-col items-center grow basis-[0%] h-full gap-2.5">
                  <div className="grow basis-[0%] flex items-end justify-center w-full gap-1.25">
                    <div className="w-4 h-19.5 rounded-tl-[5px] rounded-tr-[5px] shrink-0 bg-[#10B981]" />
                    <div className="w-4 h-13 rounded-tl-[5px] rounded-tr-[5px] shrink-0 bg-[#B56A5A]" />
                  </div>
                  <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-medium text-[#8A94A3] text-xs/4">Sem 1</div>
                </div>
                <div className="flex flex-col items-center grow basis-[0%] h-full gap-2.5">
                  <div className="grow basis-[0%] flex items-end justify-center w-full gap-1.25">
                    <div className="w-4 h-11.5 rounded-tl-[5px] rounded-tr-[5px] shrink-0 bg-[#10B981]" />
                    <div className="w-4 h-22 rounded-tl-[5px] rounded-tr-[5px] shrink-0 bg-[#B56A5A]" />
                  </div>
                  <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-medium text-[#8A94A3] text-xs/4">Sem 2</div>
                </div>
                <div className="flex flex-col items-center grow basis-[0%] h-full gap-2.5">
                  <div className="grow basis-[0%] flex items-end justify-center w-full gap-1.25">
                    <div className="w-4 h-30 rounded-tl-[5px] rounded-tr-[5px] shrink-0 bg-[#10B981]" />
                    <div className="w-4 h-10 rounded-tl-[5px] rounded-tr-[5px] shrink-0 bg-[#B56A5A]" />
                  </div>
                  <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-medium text-[#8A94A3] text-xs/4">Sem 3</div>
                </div>
                <div className="flex flex-col items-center grow basis-[0%] h-full gap-2.5">
                  <div className="grow basis-[0%] flex items-end justify-center w-full gap-1.25">
                    <div className="w-4 h-16 rounded-tl-[5px] rounded-tr-[5px] shrink-0 bg-[#10B981]" />
                    <div className="w-4 h-18 rounded-tl-[5px] rounded-tr-[5px] shrink-0 bg-[#B56A5A]" />
                  </div>
                  <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-medium text-[#8A94A3] text-xs/4">Sem 4</div>
                </div>
                <div className="flex flex-col items-center grow basis-[0%] h-full gap-2.5">
                  <div className="grow basis-[0%] flex items-end justify-center w-full gap-1.25">
                    <div className="w-4 h-8.5 rounded-tl-[5px] rounded-tr-[5px] shrink-0 bg-[#10B981]" />
                    <div className="w-4 h-7 rounded-tl-[5px] rounded-tr-[5px] shrink-0 bg-[#B56A5A]" />
                  </div>
                  <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-medium text-[#8A94A3] text-xs/4">Sem 5</div>
                </div>
              </div>
              <div className="h-px shrink-0 bg-[#EEF1F4]" />
              <div className="flex items-center justify-between gap-5">
                <div className="flex flex-col gap-0.5">
                  <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-medium text-[#6B7683] text-[13px]/4">
                    Balance
                  </div>
                  <div className="tracking-[-0.02em] inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-bold text-[#10B981] text-2xl/7.5">
                    + $ 184.300
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex flex-col gap-0.75">
                    <div className="flex items-center gap-1.75">
                      <div className="rounded-[3px] shrink-0 bg-[#10B981] size-2" />
                      <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-medium text-[#6B7683] text-xs/4">Ingresos</div>
                    </div>
                    <div className="inline-block pl-3.75">
                      <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-semibold text-[#0B1A2B] text-[15px]/4.5">$ 842.000</div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.75">
                    <div className="flex items-center gap-1.75">
                      <div className="rounded-[3px] shrink-0 bg-[#B56A5A] size-2" />
                      <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-medium text-[#6B7683] text-xs/4">Gastos</div>
                    </div>
                    <div className="inline-block pl-3.75">
                      <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-semibold text-[#0B1A2B] text-[15px]/4.5">$ 657.700</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col w-98 shrink-0 gap-5">
            <div className="flex flex-col rounded-2xl p-6 gap-4.5 [box-shadow:#1A17140D_0px_1px_2px] bg-white border border-solid border-[#E6EAEF]">
              <div className="flex flex-col gap-0.5">
                <div className="tracking-[-0.01em] inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-semibold text-[#0B1A2B] text-lg/5.5">
                  Lo que viene
                </div>
                <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-medium text-[#8A94A3] text-[13px]/4">
                  Próximas 2 semanas
                </div>
              </div>
              <div className="tracking-[0.06em] uppercase inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-semibold text-[#B56A5A] text-xs/4">
                A pagar
              </div>
              <div className="flex flex-col gap-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-10.5 h-11.5 shrink-0 flex flex-col items-center justify-center rounded-[10px] gap-px bg-[#F6F7F9]">
                    <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-bold text-[#0B1A2B] text-base/4.5">28</div>
                    <div className="tracking-[0.04em] uppercase inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-semibold text-[#8A94A3] text-[10px]/3">May</div>
                  </div>
                  <div className="flex flex-col grow basis-[0%] min-w-0 gap-0.5">
                    <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-medium text-[#0B1A2B] text-[15px]/4.5">Alquiler</div>
                    <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-medium text-[#8A94A3] text-xs/4">Recurrente · Vivienda</div>
                  </div>
                  <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-semibold text-[#B56A5A] text-[15px]/4.5">$ 420.000</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10.5 h-11.5 shrink-0 flex flex-col items-center justify-center rounded-[10px] gap-px bg-[#F6F7F9]">
                    <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-bold text-[#0B1A2B] text-base/4.5">02</div>
                    <div className="tracking-[0.04em] uppercase inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-semibold text-[#8A94A3] text-[10px]/3">Jun</div>
                  </div>
                  <div className="flex flex-col grow basis-[0%] min-w-0 gap-0.5">
                    <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-medium text-[#0B1A2B] text-[15px]/4.5">Expensas</div>
                    <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-medium text-[#8A94A3] text-xs/4">Recurrente · Vivienda</div>
                  </div>
                  <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-semibold text-[#B56A5A] text-[15px]/4.5">$ 78.500</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10.5 h-11.5 shrink-0 flex flex-col items-center justify-center rounded-[10px] gap-px bg-[#F6F7F9]">
                    <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-bold text-[#0B1A2B] text-base/4.5">05</div>
                    <div className="tracking-[0.04em] uppercase inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-semibold text-[#8A94A3] text-[10px]/3">Jun</div>
                  </div>
                  <div className="flex flex-col grow basis-[0%] min-w-0 gap-0.5">
                    <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-medium text-[#0B1A2B] text-[15px]/4.5">Netflix</div>
                    <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-medium text-[#8A94A3] text-xs/4">Suscripción · Ocio</div>
                  </div>
                  <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-semibold text-[#B56A5A] text-[15px]/4.5">$ 7.200</div>
                </div>
              </div>
              <div className="inline-block pt-0.5">
                <div className="inline-block tracking-[0.06em] uppercase font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-semibold text-[#10B981] text-xs/4">
                  A cobrar
                </div>
              </div>
              <div className="flex flex-col gap-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-10.5 h-11.5 shrink-0 flex flex-col items-center justify-center rounded-[10px] gap-px bg-[#ECFDF5]">
                    <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-bold text-[#059669] text-base/4.5">31</div>
                    <div className="tracking-[0.04em] uppercase inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-semibold text-[#10B981] text-[10px]/3">May</div>
                  </div>
                  <div className="flex flex-col grow basis-[0%] min-w-0 gap-0.5">
                    <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-medium text-[#0B1A2B] text-[15px]/4.5">Sueldo</div>
                    <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-medium text-[#8A94A3] text-xs/4">Recurrente · Ingreso</div>
                  </div>
                  <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-semibold text-[#10B981] text-[15px]/4.5">$ 1.250.000</div>
                </div>
              </div>
              <div className="h-px shrink-0 bg-[#EEF1F4]" />
              <div className="flex items-center justify-between">
                <div className="inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-medium text-[#6B7683] text-sm/4.5">
                  Balance del período
                </div>
                <div className="tracking-[-0.01em] inline-block font-['Plus_Jakarta_Sans',system-ui,sans-serif] font-bold text-[#10B981] text-lg/5.5">
                  + $ 744.300
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
