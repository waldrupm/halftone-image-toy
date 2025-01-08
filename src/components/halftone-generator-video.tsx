"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useAnimation } from "motion/react"
import { Slider } from "@/components/ui/slider"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"

export default function HalftoneGenerator() {
  const [gridSize, setGridSize] = useState(10)
  const [dotScale, setDotScale] = useState(1)
  const [useGradient, setUseGradient] = useState(false)
  const [startColor, setStartColor] = useState("#ffffff")
  const [endColor, setEndColor] = useState("#000000")
  const [gradientAngle, setGradientAngle] = useState(0)
  const [isVideo, setIsVideo] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [currentImage, setCurrentImage] = useState<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const outputCanvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const animationRef = useRef<number | null>(null)
  const controls = useAnimation()

  const processFrame = useCallback((source: HTMLVideoElement | HTMLImageElement) => {
    const canvas = canvasRef.current
    const outputCanvas = outputCanvasRef.current
    if (!canvas || !outputCanvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const width = source instanceof HTMLVideoElement ? source.videoWidth : source.width
    const height = source instanceof HTMLVideoElement ? source.videoHeight : source.height

    if (!width || !height || width === 0 || height === 0) {
      console.error('Invalid image dimensions:', width, height);
      return;
    }

    canvas.width = width
    canvas.height = height
    outputCanvas.width = width
    outputCanvas.height = height

    ctx.drawImage(source, 0, 0, width, height)

    const imageData = ctx.getImageData(0, 0, width, height)
    const pixels = imageData.data

    const outputCtx = outputCanvas.getContext("2d")
    if (!outputCtx) return

    outputCtx.fillStyle = "black"
    outputCtx.fillRect(0, 0, width, height)

    const getGradientColor = (x: number, y: number) => {
      if (!useGradient) return startColor

      const angle = gradientAngle * (Math.PI / 180)
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)

      const normalizedX = (x * cos + y * sin) / (width * cos + height * sin)
      const r1 = parseInt(startColor.slice(1, 3), 16)
      const g1 = parseInt(startColor.slice(3, 5), 16)
      const b1 = parseInt(startColor.slice(5, 7), 16)
      const r2 = parseInt(endColor.slice(1, 3), 16)
      const g2 = parseInt(endColor.slice(3, 5), 16)
      const b2 = parseInt(endColor.slice(5, 7), 16)

      const r = Math.round(r1 + normalizedX * (r2 - r1))
      const g = Math.round(g1 + normalizedX * (g2 - g1))
      const b = Math.round(b1 + normalizedX * (b2 - b1))

      return `rgb(${r}, ${g}, ${b})`
    }

    for (let y = 0; y < height; y += gridSize) {
      for (let x = 0; x < width; x += gridSize) {
        let brightness = 0
        let samples = 0

        for (let sy = 0; sy < gridSize && y + sy < height; sy++) {
          for (let sx = 0; sx < gridSize && x + sx < width; sx++) {
            const i = ((y + sy) * width + (x + sx)) * 4
            brightness += (pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114) / 255
            samples++
          }
        }

        brightness = brightness / samples

        const radius = (brightness * gridSize * 0.5 * dotScale)

        outputCtx.fillStyle = getGradientColor(x, y)
        outputCtx.beginPath()
        outputCtx.arc(x + gridSize / 2, y + gridSize / 2, radius, 0, Math.PI * 2)
        outputCtx.fill()
      }
    }
  }, [gridSize, dotScale, useGradient, startColor, endColor, gradientAngle])

  const processVideo = useCallback(() => {
    const video = videoRef.current
    if (video && !video.paused && !video.ended) {
      processFrame(video)
      animationRef.current = requestAnimationFrame(processVideo)
    }
  }, [processFrame])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      if (file.type.startsWith("image/")) {
        setIsVideo(false);
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            if (img.width > 0 && img.height > 0) {
              setCurrentImage(img);
              processFrame(img);
            } else {
              console.error('Loaded image has invalid dimensions');
            }
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
      } else if (file.type.startsWith("video/")) {
        setIsVideo(true);
        const video = videoRef.current;
        if (video) {
          video.src = URL.createObjectURL(file);
          video.onloadedmetadata = () => {
            if (video.videoWidth > 0 && video.videoHeight > 0) {
              setIsPlaying(false);
              processFrame(video);
            } else {
              console.error('Loaded video has invalid dimensions');
            }
          };
        }
      }
    }
  }, [processFrame]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current
    if (video) {
      if (video.paused) {
        video.play()
        setIsPlaying(true)
        animationRef.current = requestAnimationFrame(processVideo)
      } else {
        video.pause()
        setIsPlaying(false)
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
        }
      }
    }
  }, [processVideo])

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (currentImage && currentImage.width > 0 && currentImage.height > 0) {
      processFrame(currentImage);
    } else if (isVideo && videoRef.current && videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
      processFrame(videoRef.current);
    }
  }, [gridSize, dotScale, useGradient, startColor, endColor, gradientAngle, processFrame, currentImage, isVideo]);

  useEffect(() => {
    controls.start(isDragging ? { scale: 1.05, borderColor: "#3b82f6" } : { scale: 1, borderColor: "#3f3f46" })
  }, [isDragging, controls])

  return (
    <div className="min-h-screen bg-black p-8 font-mono text-white">
      <div className="max-w-[1400px] mx-auto overflow-hidden">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="lg:w-[70%] p-8 bg-zinc-900 rounded-xl">
            <div
              className="border-2 border-dashed border-zinc-700 rounded-lg p-8 text-center h-full flex items-center justify-center"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              style={{
                transform: isDragging ? 'scale(1.05)' : 'scale(1)',
                borderColor: isDragging ? '#3b82f6' : '#3f3f46',
                transition: 'transform 0.2s, border-color 0.2s'
              }}
            >
              {currentImage || (videoRef.current && videoRef.current.src) ? (
                <canvas
                  ref={outputCanvasRef}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <p>Drag and drop an image or video here</p>
              )}
            </div>
          </div>
          <Card className="lg:w-[30%] bg-zinc-800 rounded-xl overflow-hidden border border-zinc-700">
            <CardContent className="p-6 space-y-6">
              <div>
                <Label htmlFor="grid-size" className="text-white mb-2 block">Grid Size: {gridSize}px</Label>
                <Slider
                  id="grid-size"
                  value={[gridSize]}
                  onValueChange={([value]) => setGridSize(value)}
                  min={5}
                  max={20}
                  step={1}
                  className="[&_[role=slider]]:bg-white"
                />
              </div>

              <div>
                <Label htmlFor="dot-scale" className="text-white mb-2 block">Dot Scale: {dotScale.toFixed(1)}x</Label>
                <Slider
                  id="dot-scale"
                  value={[dotScale]}
                  onValueChange={([value]) => setDotScale(value)}
                  min={0.1}
                  max={2}
                  step={0.1}
                  className="[&_[role=slider]]:bg-white"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="use-gradient"
                  checked={useGradient}
                  onCheckedChange={setUseGradient}
                  className="data-[state=checked]:bg-white data-[state=checked]:text-black"
                />
                <Label htmlFor="use-gradient" className="text-white">Use Gradient</Label>
              </div>

              {useGradient ? (
                <>
                  <div>
                    <Label htmlFor="start-color" className="text-white mb-2 block">Start Color</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="start-color"
                        type="color"
                        value={startColor}
                        onChange={(e) => setStartColor(e.target.value)}
                        className="w-10 h-10 p-1 bg-transparent"
                      />
                      <Input
                        type="text"
                        value={startColor}
                        onChange={(e) => setStartColor(e.target.value)}
                        className="flex-1 bg-zinc-700 border-zinc-600 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="end-color" className="text-white mb-2 block">End Color</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="end-color"
                        type="color"
                        value={endColor}
                        onChange={(e) => setEndColor(e.target.value)}
                        className="w-10 h-10 p-1 bg-transparent"
                      />
                      <Input
                        type="text"
                        value={endColor}
                        onChange={(e) => setEndColor(e.target.value)}
                        className="flex-1 bg-zinc-700 border-zinc-600 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="gradient-angle" className="text-white mb-2 block">Gradient Angle: {gradientAngle}°</Label>
                    <Slider
                      id="gradient-angle"
                      value={[gradientAngle]}
                      onValueChange={([value]) => setGradientAngle(value)}
                      min={0}
                      max={360}
                      step={1}
                      className="[&_[role=slider]]:bg-white"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <Label htmlFor="dot-color" className="text-white mb-2 block">Dot Color</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="dot-color"
                      type="color"
                      value={startColor}
                      onChange={(e) => setStartColor(e.target.value)}
                      className="w-10 h-10 p-1 bg-transparent"
                    />
                    <Input
                      type="text"
                      value={startColor}
                      onChange={(e) => setStartColor(e.target.value)}
                      className="flex-1 bg-zinc-700 border-zinc-600 text-white"
                    />
                  </div>
                </div>
              )}

              {isVideo && (
                <Button onClick={togglePlayPause} className="w-full bg-white text-black hover:bg-gray-200">
                  {isPlaying ? "Pause" : "Play"}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <video ref={videoRef} className="hidden" />
    </div>
  )
}

