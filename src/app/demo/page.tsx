"use client"

import { Button } from "@/components/ui/button"
import { useState } from "react"


export default function Demo() {

  const [loading, setLoading] = useState(false)
  const [loading2, setLoading2] = useState(false)
  
  const handleBlocking = async () => {
    setLoading(true)
    await fetch("/api/demo/blocking", { method: "POST" })
    setLoading(false)
  }
  
  const handleBackground = async () => {
    setLoading2(true)
    await fetch("/api/demo/background", { method: "POST" })
    setLoading2(false)
  }
  
  return (
    <div className='p-8 space-x-4'>
      <Button onClick={handleBlocking} disabled={loading}>
        {loading ? "Loading..." : "Blocking"}
      </Button>

      <Button onClick={handleBackground} disabled={loading}>
        {loading ? "Loading..." : "Background"}
      </Button>
    </div>
  )
}