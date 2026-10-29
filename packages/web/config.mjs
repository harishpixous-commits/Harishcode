const stage = process.env.SST_STAGE || "dev"

export default {
  url: stage === "production" ? "https://harishcode.ai" : `https://${stage}.harishcode.ai`,
  console: stage === "production" ? "https://harishcode.ai/auth" : `https://${stage}.harishcode.ai/auth`,
  email: "help@github.com/harishpixous-commits",
  socialCard: "https://social-cards.sst.dev",
  github: "https://github.com/harishpixous-commits/Harishcode",
  discord: "https://harishcode.ai/discord",
  headerLinks: [
    { name: "app.header.home", url: "/" },
    { name: "app.header.docs", url: "/v2/docs" },
  ],
}
