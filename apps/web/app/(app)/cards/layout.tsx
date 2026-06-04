import { CardsHeader } from './_components/cards-header'

const CardsLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col gap-6">
    <CardsHeader />
    {children}
  </div>
)

export default CardsLayout
