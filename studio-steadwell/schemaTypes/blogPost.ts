import { defineField, defineType } from 'sanity'

const blogPost = defineType({
  name: 'blogPost',
  title: 'Blog Post',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title', maxLength: 96 },
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'tag',
      title: 'Tag',
      type: 'string',
      options: {
        list: [
          { title: 'Maintenance', value: 'Maintenance' },
          { title: 'Finance', value: 'Finance' },
          { title: 'Tips', value: 'Tips' },
          { title: 'Appliances', value: 'Appliances' },
          { title: 'Comparison', value: 'Comparison' },
          { title: 'Safety', value: 'Safety' },
          { title: 'DIY', value: 'DIY' },
        ],
        layout: 'radio',
      },
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'publishedAt',
      title: 'Published Date',
      type: 'date',
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'readTime',
      title: 'Read Time',
      type: 'string',
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'array',
      of: [{ type: 'block' }],
    }),
  ],
  preview: {
    select: { title: 'title', subtitle: 'tag' },
  },
})

export default blogPost
