import { Elysia, t } from "elysia";
import { prisma } from "./db";
import { jwt } from "@elysiajs/jwt";

const app = new Elysia()
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET!,
      exp: "7d",
    })
  )

// .get("/users", async ({ headers, set, jwt }) => {
//   const authorization = headers.authorization;

//   if (!authorization || !authorization.startsWith("Bearer ")) {
//     set.status = 401;
//     return { error: "Token não enviado." };
//   }

//   const token = authorization.slice(7);
//   const payload = await jwt.verify(token);

//   if (!payload) {
//     set.status = 401;
//     return { error: "Token inválido." };
//   }

//   const users = await prisma.user.findMany({
//     select: {
//       id: true,
//       email: true,
//       posts: true,
//     },
//   });

//   return users;
// })

.post("/auth/basic", async ({ headers, set, jwt }) => {
  const authorization = headers.authorization;

  if (!authorization) {
    set.status = 401;
    return { error: "Header Authorization não enviado." };
  }

  if (!authorization.startsWith("Basic ")) {
    set.status = 401;
    return { error: "Tipo de autenticação inválido." };
  }

  const base64Credentials = authorization.slice(6);
  const decodedCredentials = Buffer.from(base64Credentials, "base64").toString("utf-8");

  const [user, pass] = decodedCredentials.split(":");

  if (user !== process.env.BASIC_AUTH_USER || pass !== process.env.BASIC_AUTH_PASS) {
    set.status = 401;
    return { error: "Usuário ou senha inválidos." };
  }

  const token = await jwt.sign({
    sub: user,
    role: "admin",
  });

  return { token };
})


.get(
    "/users/:id",
    async ({ params, set }) => {
      const id = Number(params.id);
      if (Number.isNaN(id)) {
        set.status = 400;
        return { error: "Invalid id" };
      }

      const user = await prisma.user.findUnique({
        where: { id },
        include: { posts: true },
      });

      if (!user) {
        set.status = 404;
        return { error: "User not found" };
      }

      return user;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
)

.post(
  "/users",
  async ({ body, set }) => {
    try {
      const data = body as { email: string; password: string };

      data.password = await Bun.password.hash(data.password);

      const created = await prisma.user.create({
        data,
        include: { posts: true },
      });

      set.status = 201;
      return created;
    } catch {
      set.status = 400;
      return { error: "Email já existe ou dados inválidos" };
    }
  },
  {
    body: t.Object({
      email: t.String({ format: "email" }),
      password: t.String({ minLength: 6 }),
    }),
  }
)

.put(
  "/users/:id",
  async ({ params, body, set }) => {
    const id = Number(params.id);
    if (Number.isNaN(id)) return (set.status = 400, { error: "Invalid id" });

    const data = body as { email?: string; password?: string };

    if (data.password) {
      data.password = await Bun.password.hash(data.password);
    }

    try {
      return await prisma.user.update({
        where: { id },
        data,
      });
    } catch {
      set.status = 404;
      return { error: "User not found" };
    }
  },
  {
    body: t.Object({
      email: t.Optional(t.String()),
      password: t.Optional(t.String()),
    }),
  }
)

.delete(
    "/users/:id",
    async ({ params, set }) => {
      const id = Number(params.id);
      if (Number.isNaN(id)) {
        set.status = 400;
        return { error: "Invalid id" };
      }

      try {
        await prisma.user.delete({ where: { id } });
        return { ok: true };
      } catch {
        set.status = 404;
        return { error: "User not found" };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
)

.get("/post/user/:authorId", async ({ params, set }) => {
  const authorId = Number(params.authorId);

  if (Number.isNaN(authorId)) {
    set.status = 400;
    return { error: "Invalid authorId" };
  }

  return prisma.post.findMany({
    where: { authorId },
  });
},
    {
      params: t.Object({
        authorId: t.String(),
      }),
    })


.get("/post/:id", async ({set, params}) => {
    const id = Number(params.id);
    if(!params.id) return `Error (${set.status = 400}: Id not found!)`;

    try {
      const posts = await prisma.post.findUnique({
        where: { id }
      });
      if (!posts) {
        set.status = 404;
        return { error: "Post not found" };
      }
      return posts;
    } catch (error) {
      return error;
    }
})

.post(
  "/post/user/:authorId",
  async ({ set, body, params }) => {
    const authorId = Number(params.authorId);

    if (Number.isNaN(authorId)) {
      set.status = 400;
      return { error: "Invalid authorId" };
    }

    try {
      const post = await prisma.post.create({
        data: {
          title: (body as { title?: string }).title ?? "",
          authorId,
        },
      });

      return post;
    } catch {
      set.status = 400;
      return { error: "Could not create post" };
    }
  },
  {
    params: t.Object({
      authorId: t.String(),
    }),
    body: t.Object({
      title: t.String({ minLength: 1 }),
    }),
  }
)

.put(
  "/post/:id",
  async ({ set, body, params }) => {
    const id = Number(params.id);

    if (Number.isNaN(id)) {
      set.status = 400;
      return { error: "Invalid id" };
    }

    try {
      const post = await prisma.post.update({
        data: {
          title: (body as { title?: string }).title ?? ""
        },
        where: { id }
      });

      return post;
    } catch {
      set.status = 400;
      return { error: "Could not updated post" };
    }
  },
  {
    params: t.Object({
      id: t.String(),
    }),
    body: t.Object({
      title: t.String({ minLength: 1 }),
    }),
  }
)
.delete(
    "/post/:id",
    async ({ params, set }) => {
      const id = Number(params.id);
      if (Number.isNaN(id)) {
        set.status = 400;
        return { error: "Invalid id" };
      }

      try {
        await prisma.post.delete({ where: { id } });
        return { ok: true };
      } catch {
        set.status = 404;
        return { error: "Post not found" };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
)

  .listen(3000);

console.log(`🟢 http://localhost:${app.server?.port}`);