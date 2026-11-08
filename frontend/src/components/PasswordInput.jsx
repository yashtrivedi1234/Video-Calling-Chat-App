import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";

export default function PasswordInput({ className = "", ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={`${className} pr-12`} />
      <button
        type="button"
        className="absolute inset-y-0 right-0 px-3 text-base-content/60 hover:text-primary rounded-xl focus-visible:outline-2 focus-visible:outline-primary"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-controls={props.id}
        aria-pressed={visible}
        onClick={() => setVisible(!visible)}
      >
        {visible ? <EyeOffIcon className="size-5" aria-hidden="true" /> : <EyeIcon className="size-5" aria-hidden="true" />}
      </button>
    </div>
  );
}
