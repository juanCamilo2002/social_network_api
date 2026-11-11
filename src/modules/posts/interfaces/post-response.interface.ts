export interface PostResponse {
  id: string;
  authorId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    nickname: string;
    profilePicture: string | null;
  };
}
