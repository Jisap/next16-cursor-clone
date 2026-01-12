"use client"

import { Button } from "@/components/ui/button"
import { useState } from "react"


export default function Demo() {

  const [loading, setLoading] = useState(false)
  
  const handleBlocking = async () => {
    await fetch("/api/demo/blocking", { method: "POST" })
    setLoading(false)
  }
  
  return (
    <div className='p-8 space-x-4'>
      <Button onClick={handleBlocking} disabled={loading}>
        {loading ? "Loading..." : "Blocking"}
      </Button>
    </div>
  )
}