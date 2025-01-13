"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

interface PaginationControlsProps {
  page: number
  totalPages: number
  searchQuery: string
}

const PaginationControls: React.FC<PaginationControlsProps> = ({
  page,
  totalPages,
  searchQuery,
}) => {
  const router = useRouter()

  const handlePagination = (newPage: number) => {
    const searchParams = new URLSearchParams({
      page: newPage.toString(),
      query: searchQuery,
    })
    router.push(`/?${searchParams.toString()}`)
  }

  return (
    <div className="flex justify-between mt-5">
      <Button onClick={() => handlePagination(page - 1)} disabled={page <= 1}>
        Prevv
      </Button>
      <Button
        onClick={() => handlePagination(page + 1)}
        disabled={page >= totalPages}
      >
        Nextt
      </Button>
    </div>
  )
}

export default PaginationControls
