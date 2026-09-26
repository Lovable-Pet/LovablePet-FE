import { Search } from 'lucide-react'
import { Layout } from '../../components/Layout/Layout'
import { Badge } from '../../components/Badge/Badge'

const filters = ['추천 높은 순', '긴급 보호', '최신 등록 순', '지역: 서울']

const pets = [
  { name: '보리', breed: '골든 리트리버', age: '2세', sex: '수컷 (중성화)' },
  { name: '나비', breed: '코리안숏헤어', age: '8개월', sex: '암컷 (중성화)' },
  { name: '코코', breed: '푸들', age: '1세', sex: '수컷' },
]

export function PetListPage() {
  return (
    <Layout>
      <div className="flex items-center justify-between px-4 py-4">
        <h1 className="font-[Sora] text-[20px] font-bold text-primary-500">LovablePet</h1>
        <button type="button" aria-label="search">
          <Search className="size-[22px] text-base-950" />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto px-4 pb-3">
        {filters.map((filter) => (
          <Badge key={filter} color="neutral" variant="outlined" size="md">
            {filter}
          </Badge>
        ))}
      </div>

      <div className="flex flex-1 flex-col gap-4 px-4 pb-4">
        {pets.map((pet) => (
          <div key={pet.name} className="overflow-hidden rounded-xl border border-base-200">
            <div className="flex h-[180px] items-center justify-center bg-base-100 text-4xl">
              🐶
            </div>
            <div className="flex flex-col gap-1 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[18px] font-bold text-base-950">{pet.name}</span>
                <span className="text-[13px] text-base-500">{pet.breed}</span>
              </div>
              <p className="text-[13px] text-base-500">
                {pet.age} | {pet.sex}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  )
}
