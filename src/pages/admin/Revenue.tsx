import React, { useState, useEffect } from "react";
import { collection, onSnapshot, query, where, orderBy } from "firebase/firestore";
import { db } from "../../firebase";
import { Transaction } from "../../types";
import { format, parseISO, startOfMonth } from "date-fns";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";
import { DollarSign, CreditCard, TrendingUp, Calendar, Loader2 } from "lucide-react";

const AdminRevenue = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "transactions"), 
      where("type", "==", "purchase"),
      orderBy("timestamp", "desc")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Transaction[]);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  // Calculations
  const totalRevenue = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalCredits = transactions.reduce((sum, t) => sum + (t.creditsIssued || 0), 0);
  
  // Group by month
  const monthlyDataMap = transactions.reduce((acc: any, t) => {
    const date = t.timestamp ? (t.timestamp as any).toDate() : new Date();
    const monthKey = format(date, "MMM yyyy");
    
    if (!acc[monthKey]) {
      acc[monthKey] = {
        month: monthKey,
        revenue: 0,
        credits: 0,
        transactions: 0,
        rawDate: startOfMonth(date)
      };
    }
    
    acc[monthKey].revenue += t.amount || 0;
    acc[monthKey].credits += t.creditsIssued || 0;
    acc[monthKey].transactions += 1;
    
    return acc;
  }, {});

  const monthlyData = Object.values(monthlyDataMap).sort((a: any, b: any) => 
    a.rawDate.getTime() - b.rawDate.getTime()
  );

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-serif text-neutral-900 uppercase tracking-widest">Revenue Summary</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Total Revenue</span>
            <DollarSign className="w-4 h-4 text-neutral-900" />
          </div>
          <span className="text-3xl font-serif text-neutral-900">${totalRevenue.toLocaleString()}</span>
        </div>

        <div className="bg-white p-6 border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Credits Issued</span>
            <CreditCard className="w-4 h-4 text-neutral-900" />
          </div>
          <span className="text-3xl font-serif text-neutral-900">{totalCredits.toLocaleString()}</span>
        </div>

        <div className="bg-white p-6 border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Avg. Transaction</span>
            <TrendingUp className="w-4 h-4 text-neutral-900" />
          </div>
          <span className="text-3xl font-serif text-neutral-900">
            ${transactions.length > 0 ? (totalRevenue / transactions.length).toFixed(2) : "0.00"}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white p-8 border border-neutral-200 shadow-sm">
        <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-8">Monthly Revenue</h2>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
              <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#a3a3a3', fontWeight: 700 }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#a3a3a3', fontWeight: 700 }}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip 
                cursor={{ fill: '#f9f9f9' }}
                contentStyle={{ 
                  borderRadius: '0px', 
                  border: '1px solid #e5e5e5',
                  boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
                  fontSize: '12px',
                  fontFamily: 'serif'
                }}
              />
              <Bar dataKey="revenue" fill="#171717" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Table */}
      <div className="bg-white border border-neutral-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-neutral-400">Month</th>
              <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-neutral-400">Revenue</th>
              <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-neutral-400">Credits</th>
              <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-neutral-400">Transactions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {monthlyData.slice().reverse().map((data: any) => (
              <tr key={data.month} className="hover:bg-neutral-50 transition-colors">
                <td className="px-6 py-4 font-serif text-neutral-900">{data.month}</td>
                <td className="px-6 py-4 text-neutral-900 font-medium">${data.revenue.toLocaleString()}</td>
                <td className="px-6 py-4 text-neutral-500">{data.credits.toLocaleString()} credits</td>
                <td className="px-6 py-4 text-neutral-500">{data.transactions} transactions</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminRevenue;
