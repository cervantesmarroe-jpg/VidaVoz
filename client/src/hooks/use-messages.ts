import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertMessage } from "@shared/routes";

export function useMessages() {
  return useQuery({
    queryKey: [api.messages.list.path],
    queryFn: async () => {
      const res = await fetch(api.messages.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch messages");
      const data = await res.json();
      return api.messages.list.responses[200].parse(data);
    },
  });
}

export function useCreateMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertMessage) => {
      const res = await fetch(api.messages.create.path, {
        method: api.messages.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create message");
      const responseData = await res.json();
      return api.messages.create.responses[201].parse(responseData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.messages.list.path] });
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.messages.delete.path, { id });
      const res = await fetch(url, { 
        method: api.messages.delete.method, 
        credentials: "include" 
      });
      if (!res.ok) throw new Error("Failed to delete message");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.messages.list.path] });
    },
  });
}
