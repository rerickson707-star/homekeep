import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import blogPost from './schemaTypes/blogPost'

export default defineConfig({
  name: 'default',
  title: 'Steadwell',

  projectId: '1r1eichb',
  dataset: 'production',

  plugins: [structureTool(), visionTool()],

  schema: {
    types: [blogPost],
  },
})
