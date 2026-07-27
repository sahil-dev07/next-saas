/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            // Cloudinary — transformed/uploaded images (CldImage + next/image)
            {
                protocol: 'https',
                hostname: 'res.cloudinary.com',
                port: ''
            },
            // Clerk avatars — allows rendering user.photo (Clerk image_url) via next/image
            {
                protocol: 'https',
                hostname: 'img.clerk.com',
                port: ''
            },
            {
                protocol: 'https',
                hostname: 'images.clerk.dev',
                port: ''
            }
        ]
    }
}

module.exports = nextConfig
