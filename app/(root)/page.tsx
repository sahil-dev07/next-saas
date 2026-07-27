import { Collection } from '@/components/shared/Collection'
import { navLinks } from '@/constants'
import { getAllImage } from '@/lib/actions/image.actions'
import Image from 'next/image'
import Link from 'next/link'


// Next 15: `searchParams` is a Promise and must be awaited. Typed inline instead of via the
// old shared `SearchParamProps` alias, which typed params/searchParams as plain (non-Promise)
// objects — the shape Next 15's generated per-route PageProps check rejects.
export default async function Home({ searchParams }: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedSearchParams = await searchParams

  const page = Number(resolvedSearchParams?.page) || 1
  const searchQuery = (resolvedSearchParams?.query as string) || ''

  const images = await getAllImage({ page, searchQuery })

  return (<>
    <section className='home'>
      <h1 className='home-heading'>
        Unleash Your Creative Vision with Imaginify
      </h1>

      <ul className='flex-center w-full gap-20'>
        {
          navLinks.slice(1, 5).map((link) => (
            <Link
              key={link.route}
              href={link.route}
              className='flex-center flex-col gap-2'
            >
              <li className='flex-center w-fit rounded-full bg-white p-4'>
                <Image
                  src={link.icon}
                  alt='icon'
                  width={24}
                  height={24}
                />
              </li>
              <p className='text-center p-14-medium text-white'>{link.label}</p>
            </Link>
          ))
        }
      </ul>
    </section>

    <section className='sm:mt-12'>
      <Collection
        hasSearch={true}
        images={images?.data}
        totalPages={images?.totalPage}
        page={page}
      />
    </section>
  </>
  )
}
