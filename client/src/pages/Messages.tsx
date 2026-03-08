import { useState } from "react";
import { Layout } from "@/components/Layout";
import { GazeButton } from "@/components/GazeButton";
import { useMessages, useCreateMessage, useDeleteMessage } from "@/hooks/use-messages";
import { MessageSquare, Plus, Trash2, Loader2, Thermometer, BedDouble, Lightbulb, Clock, UserRound, Music, HeartHandshake } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const PREDEFINED_MESSAGES = [
  { text: "Tengo hambre", icon: MessageSquare, phrase: "Tengo hambre. Quiero comer." },
  { text: "Tengo frío / calor", icon: Thermometer, phrase: "Tengo frío o calor. Regule la temperatura." },
  { text: "Necesito ir al baño", icon: MessageSquare, phrase: "Necesito ir al baño urgentemente." },
  { text: "Cámbiame de posición", icon: BedDouble, phrase: "Por favor, cámbieme de posición. Estoy incómodo." },
  { text: "Luz: encender/apagar", icon: Lightbulb, phrase: "Por favor, encienda o apague la luz." },
  { text: "¿Qué hora es?", icon: Clock, phrase: "¿Qué hora es? ¿Es de día o de noche?" },
  { text: "¿Cuándo viene el médico?", icon: UserRound, phrase: "¿Cuándo viene el médico?" },
  { text: "¿Cómo voy? / ¿Mejor?", icon: MessageSquare, phrase: "¿Cómo voy? ¿Estoy mejorando?" },
  { text: "Quiero ver a mi familia", icon: HeartHandshake, phrase: "Quiero ver a mi familia por favor." },
  { text: "Tengo miedo", icon: MessageSquare, phrase: "Tengo miedo. Estoy nervioso." },
  { text: "Quiero música / radio", icon: Music, phrase: "Quiero escuchar música o la radio." },
  { text: "Dame la mano", icon: HeartHandshake, phrase: "Dame la mano. No me dejes solo." },
];

export default function Messages() {
  const { data: customMessages, isLoading } = useMessages();
  const createMutation = useCreateMessage();
  const deleteMutation = useDeleteMessage();
  const [newMsg, setNewMsg] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleAdd = async () => {
    if (!newMsg.trim()) return;
    await createMutation.mutateAsync({
      text: newMsg,
      category: "messages",
      isCustom: true,
      icon: "MessageSquare",
    });
    setNewMsg("");
    setIsDialogOpen(false);
  };

  return (
    <Layout>
      <div className="h-full p-6 md:p-8 flex flex-col">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl md:text-5xl font-bold text-blue-400 uppercase tracking-widest">
            Mensajes
          </h2>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <button className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-4 rounded-2xl font-bold text-xl flex items-center gap-3 transition-colors">
                <Plus className="w-8 h-8" />
                AÑADIR MENSAJE
              </button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-700 text-white p-8 max-w-2xl rounded-3xl">
              <DialogHeader>
                <DialogTitle className="text-3xl mb-4">Añadir Nuevo Mensaje</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <Input 
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  placeholder="Escriba el mensaje aquí..."
                  className="bg-slate-800 border-slate-600 text-2xl p-6 h-20 rounded-2xl"
                />
                <DialogFooter>
                  <Button 
                    onClick={handleAdd} 
                    disabled={createMutation.isPending}
                    className="w-full h-20 text-2xl font-bold rounded-2xl bg-blue-600 hover:bg-blue-500"
                  >
                    {createMutation.isPending ? <Loader2 className="w-8 h-8 animate-spin" /> : "GUARDAR"}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 pb-20">
          {PREDEFINED_MESSAGES.map((msg, i) => {
            const Icon = msg.icon;
            return (
              <GazeButton 
                key={`pre-${i}`} 
                theme="blue" 
                speakText={msg.phrase}
                className="min-h-[140px]"
              >
                <Icon className="w-12 h-12 mb-2 opacity-80" />
                <span className="text-xl md:text-2xl font-bold tracking-wide">
                  {msg.text}
                </span>
              </GazeButton>
            );
          })}

          {isLoading ? (
            <div className="col-span-full flex justify-center py-12">
              <Loader2 className="w-16 h-16 animate-spin text-blue-500" />
            </div>
          ) : (
            customMessages?.map((msg) => (
              <div key={`custom-${msg.id}`} className="relative group h-full">
                <GazeButton 
                  theme="slate" 
                  speakText={msg.text}
                  className="min-h-[140px] border-blue-900/50"
                >
                  <span className="text-xl md:text-2xl font-bold tracking-wide">
                    {msg.text}
                  </span>
                </GazeButton>
                <button
                  onClick={() => deleteMutation.mutate(msg.id)}
                  className="absolute top-2 right-2 bg-red-500/20 text-red-400 p-3 rounded-full hover:bg-red-500 hover:text-white transition-colors"
                >
                  <Trash2 className="w-6 h-6" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
