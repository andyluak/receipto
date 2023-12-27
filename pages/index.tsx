import { useRef, useState } from "react"
import ReactCrop, { PixelCrop, type Crop } from "react-image-crop"

import { Input } from "@/components/ui/input"

import "react-image-crop/dist/ReactCrop.css"

import { useDebounceEffect } from "@/lib/useDebounceEffect"

const TO_RADIANS = Math.PI / 180

export async function canvasPreview(
  image: HTMLImageElement,
  canvas: HTMLCanvasElement,
  crop: PixelCrop,
  scale = 1,
  rotate = 0
) {
  const ctx = canvas.getContext("2d")

  if (!ctx) {
    throw new Error("No 2d context")
  }

  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height
  // devicePixelRatio slightly increases sharpness on retina devices
  // at the expense of slightly slower render times and needing to
  // size the image back down if you want to download/upload and be
  // true to the images natural size.
  const pixelRatio = window.devicePixelRatio
  // const pixelRatio = 1

  canvas.width = Math.floor(crop.width * scaleX * pixelRatio)
  canvas.height = Math.floor(crop.height * scaleY * pixelRatio)

  ctx.scale(pixelRatio, pixelRatio)
  ctx.imageSmoothingQuality = "high"

  const cropX = crop.x * scaleX
  const cropY = crop.y * scaleY

  const rotateRads = rotate * TO_RADIANS
  const centerX = image.naturalWidth / 2
  const centerY = image.naturalHeight / 2

  ctx.save()

  // 5) Move the crop origin to the canvas origin (0,0)
  ctx.translate(-cropX, -cropY)
  // 4) Move the origin to the center of the original position
  ctx.translate(centerX, centerY)
  // 3) Rotate around the origin
  ctx.rotate(rotateRads)
  // 2) Scale the image
  ctx.scale(scale, scale)
  // 1) Move the center of the image to the origin (0,0)
  ctx.translate(-centerX, -centerY)
  ctx.drawImage(
    image,
    0,
    0,
    image.naturalWidth,
    image.naturalHeight,
    0,
    0,
    image.naturalWidth,
    image.naturalHeight
  )

  ctx.restore()
}

export default function Home() {
  const [image, setImage] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const imgRef = useRef<HTMLImageElement | null>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const blobUrlRef = useRef("")
  const hiddenAnchorRef = useRef<HTMLAnchorElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const formData = new FormData()
    const image = e.currentTarget.image.files[0]

    console.log(image)
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const imageFile = e.currentTarget?.files?.[0]
    const reader = new FileReader()

    reader.onloadend = () => {
      console.log(reader.result)
    }
    if (!imageFile) return
    const image = reader.readAsDataURL(imageFile)

    // get the src so we can use it in our cropper
    const src = URL.createObjectURL(imageFile)

    // set the image in state
    setImage(src)
  }

  async function onDownloadCropClick() {
    const image = imgRef.current
    const previewCanvas = previewCanvasRef.current
    if (!image || !previewCanvas || !completedCrop) {
      throw new Error("Crop canvas does not exist")
    }

    // This will size relative to the uploaded image
    // size. If you want to size according to what they
    // are looking at on screen, remove scaleX + scaleY
    const scaleX = image.naturalWidth / image.width
    const scaleY = image.naturalHeight / image.height

    const offscreen = new OffscreenCanvas(
      completedCrop.width * scaleX,
      completedCrop.height * scaleY
    )
    const ctx = offscreen.getContext("2d")
    if (!ctx) {
      throw new Error("No 2d context")
    }

    ctx.drawImage(
      previewCanvas,
      0,
      0,
      previewCanvas.width,
      previewCanvas.height,
      0,
      0,
      offscreen.width,
      offscreen.height
    )
    // You might want { type: "image/jpeg", quality: <0 to 1> } to
    // reduce image size
    const blob = await offscreen.convertToBlob({
      type: "image/png",
    })

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
    }
    blobUrlRef.current = URL.createObjectURL(blob)
    hiddenAnchorRef.current!.href = blobUrlRef.current
    hiddenAnchorRef.current!.click()
  }

  useDebounceEffect(
    async () => {
      if (
        completedCrop?.width &&
        completedCrop?.height &&
        imgRef.current &&
        previewCanvasRef.current
      ) {
        // We use canvasPreview as it's much faster than imgPreview.
        canvasPreview(imgRef.current, previewCanvasRef.current, completedCrop)
      }
    },
    100,
    [completedCrop]
  )

  return (
    <section className="min-h-dvh flex items-center justify-center">
      <form onSubmit={handleSubmit}>
        <Input type="file" name="image" onChange={handleImageUpload} />
      </form>

      {image && (
        <>
          <div className="max-w-[500px] max-h-[500px] ">
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => {
                console.log(c)
                setCompletedCrop(c)
              }}
            >
              <img ref={imgRef} src={image} alt="Crop preview" />
            </ReactCrop>
          </div>
          <div>
            <canvas
              ref={previewCanvasRef}
              style={{
                border: "1px solid black",
                objectFit: "contain",
                width: completedCrop?.width,
                height: completedCrop?.height,
              }}
            />
          </div>
          <a
            href="#hidden"
            ref={hiddenAnchorRef}
            download
            style={{
              position: "absolute",
              top: "-200vh",
              visibility: "hidden",
            }}
          >
            Hidden download
          </a>
        </>
      )}
    </section>
  )
}
