import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import {
  CreateNewBlogSchema,
  UpdateBlogSchema,
} from "~/common/validation/blog-validation";
import * as z from "zod";
import { CategoryEnum } from "~/utils/category";
export const blogRouter = createTRPCRouter({
  // [POST]
  createNewBlog: protectedProcedure
    .input(CreateNewBlogSchema)
    .mutation(async ({ ctx, input }) => {
      console.log({ input });
      const { session } = ctx;

      const { title, subtitle, body, image } = input;
      const tagArray = title.split(" ");

      // slug
      const slug = tagArray.join("-") + "-" + Date.now();
      const authorId = session?.user.id;
      const post = await ctx.prisma.post.create({
        include: {
          category: true,
        },
        data: {
          title,
          category: {
            connectOrCreate: {
              create: {
                category_name: input.category,
              },
              where: {
                category_name: input.category,
              },
            },
          },
          subtitle,
          image: image || null,
          body,
          user: {
            connect: {
              id: authorId,
            },
          },
          slug,
          tags: {
            createMany: {
              data: tagArray.map((i) => ({
                tag_name: i,
              })),
            },
          },
        },
      });

      return {
        status: 201,
        data: {
          post,
        },
      };
    }),

  // [GET]
  getAllBlogs: protectedProcedure.query(async ({ ctx }) => {
    const blogs = await ctx.prisma.post.findMany({
      select: {
        id: true,
        image: true,
        title: true,
        subtitle: true,
        createdAt: true,
        category: true,
        _count: {
          select: {
            comment: true,
            reaction: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return {
      status: 200,
      data: blogs,
    };
  }),

  // [GET] by CATEGORY
  getBlogsByCategory: protectedProcedure
    .input(
      z.object({
        category_name: z.nativeEnum(CategoryEnum),
      })
    )
    .query(async ({ ctx, input }) => {
      const blogs = await ctx.prisma.post.findMany({
        select: {
          id: true,
          image: true,
          title: true,
          subtitle: true,
          createdAt: true,
          category: true,
          _count: {
            select: {
              comment: true,
              reaction: true,
            },
          },
        },
        where: {
          category: {
            category_name: input.category_name,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10
      });
      return {
        status: 200,
        data: blogs,
      };
    }),

  // [GET ONE BLOG BY ID]
  getBlogById: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      // find blog with id
      const blog = await ctx.prisma.post.findFirst({
        where: {
          id: input.id,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              gender: true,
            },
          },
          reaction: {
            select: {
              type: true,
              user: {
                select: {
                  id: true,
                  image: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });
      return {
        status: 200,
        data: blog,
      };
    }),

  // [GET BLOG BY USERID]
  getBlogByUserId: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const blogs = await ctx.prisma.post.findMany({
        include: {
          _count: {
            select: {
              reaction: true,
              comment: true,
            },
          },
        },
        where: {
          authorId: input.userId,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
      return {
        status: 200,
        message: "BLOGS FOUND SUCCESSFULLY",
        data: blogs,
      };
    }),

  // [UPDATE BLOG BY ID]
  updateBlogById: protectedProcedure
    .input(UpdateBlogSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...restInput } = input;
      const blog = await ctx.prisma.post.update({
        data: {
          ...restInput,
        },
        where: {
          id,
        },
      });

      return {
        status: 201,
        data: blog,
        message: "BLOG UPDATED SUCCESSFULLY",
      };
    }),

  // [DELETE BLOG BY BLOGID]
  deleteBlogByBlogId: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // First, delete all comments associated with the post

      const deleteBlog = await ctx.prisma.post.delete({
        where: {
          id: input.id,
        },
        include: {
          comment: true,
        },
      });

      if (!deleteBlog) throw new TRPCError({ code: "BAD_REQUEST" });

      return {
        status: 201,
        message: "BLOG DELETED SUCCESSFULLY",
      };
    }),
});
