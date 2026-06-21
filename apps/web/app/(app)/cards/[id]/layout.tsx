const CardDetailLayout = ({ children }: { children: React.ReactNode }) => {
  // The back-link lives in each page (card detail renders its own "← Tarjetas"),
  // never here: a layout wraps every nested route (periods, statement detail,
  // edit, pay), so a back-link rendered here would duplicate the one each of
  // those pages already shows.
  return <div className="flex max-w-[1080px] flex-col gap-5">{children}</div>
}

export default CardDetailLayout
