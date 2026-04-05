import React, { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { format } from "date-fns";
import { Modal } from "../../components/Modal";

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
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);

  const sortedMessages = [...messages].sort((a, b) => {
    if (a.email !== b.email) return a.email.localeCompare(b.email);
    if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
    const dateA = a.createdAt?.toDate() || new Date(0);
    const dateB = b.createdAt?.toDate() || new Date(0);
    return dateB.getTime() - dateA.getTime();
  });

  const handleDeleteMessage = (message: Message) => {
    setMessageToDelete(message);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteMessage = async () => {
    if (messageToDelete) {
      try {
        await deleteDoc(doc(db, "messages", messageToDelete.id));
        setIsDeleteModalOpen(false);
        setIsMessageModalOpen(false);
        setMessageToDelete(null);
      } catch (error) {
        console.error("Error deleting message:", error);
      }
    }
  };

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
      <Modal 
        isOpen={isMessageModalOpen} 
        onClose={() => setIsMessageModalOpen(false)} 
        title="Message Details"
      >
        {selectedMessage && (
          <div className="space-y-4">
            <div className="text-xs text-neutral-500">
              <p><span className="font-bold uppercase tracking-widest">From:</span> {selectedMessage.email}</p>
              <p><span className="font-bold uppercase tracking-widest">Date:</span> {selectedMessage.createdAt ? format(selectedMessage.createdAt.toDate(), "MMM d, yyyy h:mm a") : "N/A"}</p>
            </div>
            <p className="text-sm text-neutral-900 font-bold">{selectedMessage.subject}</p>
            <p className="text-sm text-neutral-600 leading-relaxed">{selectedMessage.body}</p>
            <div className="flex justify-end pt-4">
              <button
                onClick={() => handleDeleteMessage(selectedMessage)}
                className="text-xs font-bold uppercase tracking-widest text-red-600 hover:text-red-800 transition-colors"
              >
                Delete Message
              </button>
            </div>
          </div>
        )}
      </Modal>
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Deletion"
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">Are you sure you want to delete this message? This action cannot be undone.</p>
          <div className="flex justify-end gap-4">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="text-xs font-bold uppercase tracking-widest text-neutral-500 hover:text-neutral-700"
            >
              Cancel
            </button>
            <button
              onClick={confirmDeleteMessage}
              className="text-xs font-bold uppercase tracking-widest text-red-600 hover:text-red-800"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
      <h1 className="text-2xl font-serif text-neutral-900">Messages</h1>
      <div className="bg-white border border-neutral-200 shadow-sm overflow-hidden">
        <div className="hidden md:block">
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
              {sortedMessages.map(message => (
                <tr 
                  key={message.id} 
                  className={`cursor-pointer hover:bg-neutral-50 transition-colors ${message.status === 'read' ? 'bg-neutral-100' : ''}`}
                  onClick={async () => {
                    setSelectedMessage(message);
                    setIsMessageModalOpen(true);
                    if (message.status !== 'read') {
                      await updateDoc(doc(db, "messages", message.id), { status: 'read' });
                    }
                  }}
                >
                  <td className="px-6 py-4 text-neutral-500">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${message.status === 'read' ? 'bg-neutral-300' : 'bg-blue-500'}`} />
                      {message.createdAt ? format(message.createdAt.toDate(), "MMM d, yyyy h:mm a") : "N/A"}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-neutral-900">{message.email}</td>
                  <td className="px-6 py-4 text-neutral-900">{message.subject}</td>
                  <td className="px-6 py-4 text-neutral-500 max-w-xs truncate">{message.body}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="md:hidden divide-y divide-neutral-100">
          {sortedMessages.map(message => (
            <div 
              key={message.id} 
              className={`p-4 cursor-pointer hover:bg-neutral-50 transition-colors ${message.status === 'read' ? 'bg-neutral-100' : ''}`}
              onClick={async () => {
                setSelectedMessage(message);
                setIsMessageModalOpen(true);
                if (message.status !== 'read') {
                  await updateDoc(doc(db, "messages", message.id), { status: 'read' });
                }
              }}
            >
              <div className="flex justify-between text-xs text-neutral-500 mb-1">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${message.status === 'read' ? 'bg-neutral-300' : 'bg-blue-500'}`} />
                  <span>{message.email}</span>
                </div>
                <span>{message.createdAt ? format(message.createdAt.toDate(), "MMM d, h:mm a") : "N/A"}</span>
              </div>
              <div className="font-bold text-sm text-neutral-900 mb-1">{message.subject}</div>
              <div className="text-xs text-neutral-500 truncate">{message.body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminMessages;
