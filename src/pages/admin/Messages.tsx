import React, { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { format } from "date-fns";

interface Message {
  id: string;
  userId: string;
  subject: string;
  email: string;
  body: string;
  status: string;
  createdAt: any;
}

const AdminMessages = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "messages"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(messagesData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching messages:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-serif text-neutral-900">Messages</h1>
      <div className="bg-white border border-neutral-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 uppercase font-bold text-[10px] tracking-widest">
            <tr>
              <th className="px-6 py-4 text-left">Date</th>
              <th className="px-6 py-4 text-left">Email</th>
              <th className="px-6 py-4 text-left">Subject</th>
              <th className="px-6 py-4 text-left">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {messages.map(message => (
              <tr key={message.id}>
                <td className="px-6 py-4 text-neutral-500">
                  {message.createdAt ? format(message.createdAt.toDate(), "MMM d, yyyy HH:mm") : "N/A"}
                </td>
                <td className="px-6 py-4 text-neutral-900">{message.email}</td>
                <td className="px-6 py-4 text-neutral-900">{message.subject}</td>
                <td className="px-6 py-4 text-neutral-500 max-w-xs truncate">{message.body}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminMessages;
