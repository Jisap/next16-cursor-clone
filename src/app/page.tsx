"use client"


import { Button } from '@/components/ui/button'
import { api } from '../../convex/_generated/api'
import { useMutation, useQuery } from 'convex/react'


const Page = () => {

  const projects = useQuery(api.projects.get)

  const createProject = useMutation(api.projects.create)

  return (
    <div className='p-4'>
      
      <Button onClick={() => createProject({ name: "Test" })}>
        Add new
      </Button>
      
      <div className='flex flex-col gap-2 border rounded-2xl p-4 '>
        {projects?.map((project, index) => (
          <div key={index} className='border-b rounded p-2 flex flex-row gap-2'>
            <p>Project name:{project.name}</p>
            <p> | </p>
            <p>OwnerId: {project.ownerId}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Page