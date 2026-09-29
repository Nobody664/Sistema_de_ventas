/// <reference types="node" />

export default {
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL ?? "",
  },
};