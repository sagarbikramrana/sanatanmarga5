import { useState, useEffect } from "react";
import { collection, query, orderBy, safeOnSnapshot as onSnapshot, getDocs, doc, updateDoc, deleteDoc } from "@/src/lib/firebase";
import { db } from "@/src/lib/firebase";
import { CommunityPost } from "@/src/types";
import AdminLayout from "@/src/components/layout/AdminLayout";
import { Shield, Trash2, CheckCircle, AlertTriangle, Eye, MessageSquare, User } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "motion/react";
import { toSafeDate } from "@/src/lib/utils";

import { snapshotEngine } from "@/src/services/snapshotEngine";
import { AdminSkeleton } from "@/src/components/ui/PageLoaders";
import { offlineQueue } from "@/src/lib/offlineQueue";

export default function AdminCommunity() {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "flagged" | "removed">("all");

  useEffect(() => {
    const q1 = query(collection(db, "communityPosts"), orderBy("createdAt", "desc"));
    const unsubscribe1 = onSnapshot(q1, async (snapshot) => {
      let postsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CommunityPost[];

      if (postsData.length === 0) {
        try {
          const snap2 = await getDocs(query(collection(db, "community_posts"), orderBy("createdAt", "desc")));
          postsData = snap2.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as CommunityPost[];
        } catch (e) {}
      }

      setPosts(postsData);
      setLoading(false);
    });
    return () => unsubscribe1();
  }, []);

  const filteredPosts = posts.filter(post => {
    if (filter === "all") return true;
    return post.status === filter;
  });

  const handleStatusChange = async (postId: string, status: string) => {
    try {
      await updateDoc(doc(db, "communityPosts", postId), { status });
    } catch (e) {}
    offlineQueue.queueAction({
      type: 'ARTICLE_UPDATE',
      collection: 'communityPosts',
      docId: postId,
      data: { status }
    });
  };

  const handleDelete = async (postId: string) => {
    if (confirm("Permanently delete this post?")) {
      setPosts(prev => prev.filter(p => p.id !== postId));
      try {
        await deleteDoc(doc(db, "communityPosts", postId));
      } catch (e) {}
      try {
        await deleteDoc(doc(db, "community_posts", postId));
      } catch (e) {}
      try {
        offlineQueue.queueAction({
          type: 'ARTICLE_DELETE',
          collection: 'communityPosts',
          docId: postId
        });
      } catch (e) {}
      try {
        offlineQueue.queueAction({
          type: 'ARTICLE_DELETE',
          collection: 'community_posts',
          docId: postId
        });
      } catch (e) {}
      try {
        snapshotEngine.triggerPublishRebuild("admin_community_delete");
      } catch (e) {}
    }
  };

  if (loading) return <AdminSkeleton />;

  return (
    <AdminLayout>
      <div className="p-4 sm:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-black text-card-foreground flex items-center gap-3">
                <Shield className="w-8 h-8 text-primary" />
                Community Moderation
              </h1>
              <p className="text-muted-text font-medium">Manage Chautari posts and reports</p>
            </div>

            <div className="flex bg-card p-1 rounded-2xl shadow-sm border border-border-theme">
              {["all", "active", "flagged", "removed"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f as any)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition-all ${
                    filter === f ? "bg-primary text-white shadow-lg" : "text-muted-text hover:bg-muted-area"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            {loading ? (
              <div className="p-20 text-center">Loading posts...</div>
            ) : filteredPosts.length > 0 ? (
              filteredPosts.map((post) => (
                <motion.div
                  key={post.id}
                  layout
                  className="bg-card p-6 rounded-3xl shadow-sm border border-border-theme flex items-start justify-between gap-6"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`px-2 py-1 rounded-full font-bold uppercase ${
                        post.status === 'active' ? 'bg-green-500/10 text-green-500' :
                        post.status === 'flagged' ? 'bg-orange-500/10 text-orange-500' :
                        'bg-red-500/10 text-red-500'
                      }`}>
                        {post.status}
                      </span>
                      <span className="text-muted-text/30">•</span>
                      <span className="font-bold text-card-foreground flex items-center gap-1">
                        <User className="w-3 h-3" /> {post.authorName}
                      </span>
                      <span className="text-muted-text/30">•</span>
                      <span className="text-muted-text">{post.createdAt ? format(toSafeDate(post.createdAt), "MMM d, yyyy") : "N/A"}</span>
                    </div>
                    <h3 className="text-lg font-bold text-card-foreground">{post.title}</h3>
                    <p className="text-muted-text text-sm line-clamp-2">{post.content}</p>
                    <div className="flex items-center gap-4 text-xs font-bold text-muted-text/50 pt-2">
                      <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {post.upvotes} Upvotes</span>
                      <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {post.commentCount} Comments</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleStatusChange(post.id, "active")}
                      className="p-3 bg-green-500/10 text-green-600 rounded-2xl hover:bg-green-500/20 transition-colors"
                      title="Approve/Active"
                    >
                      <CheckCircle className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleStatusChange(post.id, "flagged")}
                      className="p-3 bg-orange-500/10 text-orange-600 rounded-2xl hover:bg-orange-500/20 transition-colors"
                      title="Flag"
                    >
                      <AlertTriangle className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleStatusChange(post.id, "removed")}
                      className="p-3 bg-red-500/10 text-red-600 rounded-2xl hover:bg-red-500/20 transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => window.open(`/community/post/${post.id}`, "_blank")}
                      className="p-3 bg-muted-area text-muted-text rounded-2xl hover:bg-muted transition-colors border border-border-theme"
                      title="View Post"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border-theme">
                <p className="text-muted-text font-bold">No posts found for this filter</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
