"use client"

import { Button } from '@/components/ui/button'
import React from 'react'
import { api } from '../../convex/_generated/api'
import { useQuery } from 'convex/react'
import { get } from '../../convex/tasks';

const Page = () => {

  const tasks = useQuery(api.tasks.get)

  return (
    <div className='p-4'>
      <div className='flex flex-col gap-2 border rounded-2xl p-4 '>
        {tasks?.map((task, index) => (
          <div key={index} className='border-b rounded p-2 flex flex-row gap-2'>
            <p>Text: {task.text}</p>
            <p> | </p>
            <p>IsCompleted: {task.isCompleted}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Page